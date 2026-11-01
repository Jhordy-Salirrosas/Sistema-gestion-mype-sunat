/**
 * Descarga de XML, CDR y PDF de un comprobante (TA-65, HU-11).
 *
 * Antes de este servicio solo existían `GET /`, `GET /:id` y
 * `POST /:id/retry-cdr`: no había forma de recuperar el XML generado, el CDR
 * que devolvió SUNAT ni la representación impresa, que son justo las tres cosas
 * que un contribuyente necesita conservar y mostrar.
 *
 * Reglas que se respetan aquí:
 *
 *  - **Aislamiento por empresa**: la búsqueda filtra por `company_id`. Un
 *    comprobante ajeno responde 404 y no 403, para no revelar que existe.
 *  - **El XML se regenera solo si no está guardado.** Si el worker ya guardó el
 *    XML firmado, se devuelve ese: volver a generarlo cambiaría la firma y el
 *    comprobante dejaría de coincidir con el que SUNAT validó.
 *  - **El CDR se devuelve tal cual llegó.** El XML del CDR es el documento
 *    probatorio; no se reformatea ni se reindenta.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { UblGeneratorService } from '../../ublGeneratorService';
import type { InvoicePayload } from '../../invoicePayload';
import {
  InvoicePdfService,
  type DatosPdfComprobante,
  type LineaImpresa,
} from './invoicePdfService';
import { InvoiceQrService } from './invoiceQrService';

/** Tipo de archivo solicitado. */
export type TipoDescarga = 'xml' | 'cdr' | 'pdf';

/** Archivo listo para que el controlador lo entregue. */
export interface ArchivoDescarga {
  nombre: string;
  contentType: string;
  contenido: Buffer;
}

/** Nombre legible del comprobante para el PDF. */
const NOMBRE_TIPO: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
  '08': 'NOTA DE DÉBITO ELECTRÓNICA',
  '09': 'GUÍA DE REMISIÓN REMITENTE',
  '20': 'COMPROBANTE DE RETENCIÓN',
  '40': 'COMPROBANTE DE PERCEPCIÓN',
};

/** Estado de CDR que confirma una respuesta de SUNAT. */
const ESTADOS_CON_CDR = ['ACEPTADO', 'OBSERVADO', 'RECHAZADO'];

@Injectable()
export class InvoiceDownloadService {
  private readonly logger = new Logger(InvoiceDownloadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ublGenerator: UblGeneratorService,
    private readonly pdf: InvoicePdfService,
    private readonly qr: InvoiceQrService,
  ) {}

  /** Devuelve el archivo solicitado o lanza 404 si no corresponde. */
  public async descargar(
    companyId: string,
    invoiceId: string,
    tipo: TipoDescarga,
  ): Promise<ArchivoDescarga> {
    const fila = await this.cargar(companyId, invoiceId);

    if (tipo === 'xml') return this.xml(fila);
    if (tipo === 'cdr') return this.cdr(fila);
    return this.pdfDelComprobante(fila);
  }

  /**
   * Fila mínima del comprobante, con sus ítems y su cliente.
   *
   * Los NOMBRES DE CAMPO son los del modelo `Invoice`, no los del DTO de la API.
   * Antes se pedían `moneda`, `cdr_codigo`, `cliente_nombre` y
   * `cliente_documento`, que no existen en la tabla: Prisma lanzaba
   * `Unknown field 'moneda' for select statement` y las descargas de XML, PDF y
   * CDR respondían 500 en comprobantes ya aceptados. Se detectó probando la
   * descarga de una factura ACEPTADA el 31-10; los tests no lo veían porque
   * usan un Prisma simulado que acepta cualquier campo.
   *
   * Correspondencia: moneda -> currency_code, cdr_codigo -> sunat_response_code,
   * cliente_nombre -> customer_legal_name,
   * cliente_documento -> customer_identity_number.
   */
  private async cargar(companyId: string, invoiceId: string) {
    const fila = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, company_id: companyId },
      select: {
        id: true,
        ruc_emisor: true,
        tipo_comprobante: true,
        serie: true,
        correlativo: true,
        fecha_emision: true,
        estado: true,
        currency_code: true,
        payload_ubl: true,
        xml_storage_url: true,
        cdr_storage_url: true,
        cdr_sunat: true,
        sunat_response_code: true,
        customer_legal_name: true,
        customer_identity_number: true,
        items: {
          orderBy: { item_order: 'asc' },
          select: {
            description: true,
            unit_code: true,
            quantity: true,
            unit_value: true,
            igv_amount: true,
            total_amount: true,
            igv_affectation_type: true,
          },
        },
      },
    });

    if (!fila) {
      // 404 y no 403: revelar que el comprobante existe en otra empresa ya es
      // filtrar información.
      throw new NotFoundException(`El comprobante ${invoiceId} no existe.`);
    }

    return fila;
  }

  /** Nombre del archivo XML según la convención de SUNAT. */
  private nombreBase(fila: {
    ruc_emisor: string;
    tipo_comprobante: string;
    serie: string;
    correlativo: number;
  }): string {
    return `${fila.ruc_emisor}-${fila.tipo_comprobante}-${fila.serie}-${fila.correlativo}`;
  }

  /** XML del comprobante: el guardado si existe, o regenerado desde el payload. */
  private xml(fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>): ArchivoDescarga {
    const guardado = fila.xml_storage_url;
    const esXml = guardado && guardado.trimStart().startsWith('<?xml');

    const contenido = esXml
      ? Buffer.from(guardado, 'utf8')
      : Buffer.from(this.regenerarXml(fila), 'utf8');

    return {
      nombre: `${this.nombreBase(fila)}.xml`,
      contentType: 'application/xml; charset=utf-8',
      contenido,
    };
  }

  /** Regenera el XML desde `payload_ubl`. */
  private regenerarXml(
    fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>,
  ): string {
    const payload = fila.payload_ubl as unknown as InvoicePayload | null;
    if (!payload || typeof payload !== 'object') {
      throw new NotFoundException(
        'El comprobante no tiene XML guardado ni payload para regenerarlo.',
      );
    }

    // Se avisa en el log porque el XML regenerado NO lleva la firma original:
    // sirve para consulta, no como respaldo probatorio.
    this.logger.warn(
      `Comprobante ${fila.serie}-${fila.correlativo} sin XML guardado: se regenera sin firma`,
    );

    return this.ublGenerator.generateInvoiceXml(payload);
  }

  /**
   * CDR devuelto por SUNAT, tal cual llegó.
   *
   * SE LEE DE `cdr_sunat`, que es donde el worker lo guarda
   * (`cdr-persistence.service.ts`). Antes se leía solo de `cdr_storage_url`, un
   * campo pensado para la URL de un almacenamiento externo que nunca se
   * implementó: el CDR real viajaba en `cdr_sunat` y la descarga respondía 404
   * "no tiene el CDR guardado" en comprobantes ACEPTADOS. Se detectó probando
   * la descarga de una factura aceptada el 31-10.
   *
   * Se aceptan las dos fuentes: `cdr_sunat` (el XML en crudo que guarda el
   * worker) y, si algún día existe, `cdr_storage_url`.
   */
  private cdr(fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>): ArchivoDescarga {
    const cdr = this.xmlDelCdr(fila);

    if (!cdr || !cdr.trimStart().startsWith('<?xml')) {
      // Un comprobante en cola o en error todavía no tiene CDR: es un 404 con
      // un mensaje que dice qué falta, no un archivo vacío.
      throw new NotFoundException(
        ESTADOS_CON_CDR.includes(fila.estado)
          ? 'El comprobante no tiene el CDR guardado.'
          : `El comprobante está en estado ${fila.estado}: todavía no tiene CDR.`,
      );
    }

    return {
      nombre: `${this.nombreBase(fila)}.cdr.xml`,
      contentType: 'application/xml; charset=utf-8',
      contenido: Buffer.from(cdr, 'utf8'),
    };
  }

  /** Extrae el XML del CDR de la columna donde lo haya guardado el worker. */
  private xmlDelCdr(
    fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>,
  ): string | null {
    const almacenado = fila.cdr_storage_url?.trim();
    if (almacenado?.startsWith('<?xml')) return almacenado;

    // `cdr_sunat` es un JSON: el worker guarda el CDR parseado con su `rawXml`.
    const crudo = fila.cdr_sunat as unknown;
    if (!crudo) return null;

    if (typeof crudo === 'string') return crudo;

    if (typeof crudo === 'object' && crudo !== null) {
      const candidato = (crudo as Record<string, unknown>)['rawXml'];
      if (typeof candidato === 'string') return candidato;
    }

    return null;
  }

  /** Representación impresa en PDF. */
  private async pdfDelComprobante(
    fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>,
  ): Promise<ArchivoDescarga> {
    const datos = await this.datosPdf(fila);
    const contenido = await this.pdf.generar(datos);

    return {
      nombre: this.pdf.nombreArchivo(datos),
      contentType: 'application/pdf',
      contenido,
    };
  }

  /** Liquida los importes a partir de los ítems GUARDADOS. */
  private async datosPdf(
    fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>,
  ): Promise<DatosPdfComprobante> {
    const gratuitas = new Set([
      '11', '12', '13', '14', '15', '16',
      '21', '31', '32', '33', '34', '35', '36',
    ]);

    const lineas: LineaImpresa[] = fila.items.map((item) => ({
      descripcion: item.description,
      unidad: item.unit_code,
      cantidad: Number(item.quantity),
      valorUnitario: Number(item.unit_value),
      igv: Number(item.igv_amount),
      total: Number(item.total_amount),
    }));

    let gravado = 0;
    let exonerado = 0;
    let inafecto = 0;

    for (const item of fila.items) {
      const afectacion = item.igv_affectation_type;
      if (gratuitas.has(afectacion)) continue;

      const valor = Number(item.quantity) * Number(item.unit_value);
      if (!Number.isFinite(valor)) continue;

      if (afectacion.startsWith('10')) gravado += valor;
      else if (afectacion.startsWith('2')) exonerado += valor;
      else if (afectacion.startsWith('3') || afectacion.startsWith('4')) {
        inafecto += valor;
      }
    }

    const centimos = (n: number): number => Math.round(n * 100) / 100;
    const gravadoR = centimos(gravado);
    const igv = centimos(gravadoR * 0.18);
    const icbper = centimos(
      fila.items.reduce((acc, i) => acc + Number(i.igv_amount), 0),
    );

    const payload = (fila.payload_ubl ?? {}) as Record<string, unknown>;
    const detraccion = Number(payload['montoDetraccion'] ?? 0) || 0;
    const total = centimos(gravadoR + igv + exonerado + inafecto);

    const fecha = fila.fecha_emision.toISOString().slice(0, 10);
    const qrBase64 = await this.qr.generarPng({
      rucEmisor: fila.ruc_emisor,
      tipoComprobante: fila.tipo_comprobante,
      serie: fila.serie,
      correlativo: fila.correlativo,
      igv,
      total,
      fechaEmision: fecha,
      tipoDocCliente:
        String(fila.customer_identity_number ?? '').length === 11 ? '6' : '1',
      numDocCliente: fila.customer_identity_number ?? '',
      hashCpe: String(payload['hashCpe'] ?? ''),
    });

    return {
      rucEmisor: fila.ruc_emisor,
      razonSocialEmisor: String(payload['razonSocialEmisor'] ?? 'EMPRESA EMISORA'),
      direccionEmisor: payload['direccionEmisor'] as string | undefined,
      tipoComprobante: fila.tipo_comprobante,
      serie: fila.serie,
      correlativo: fila.correlativo,
      fechaEmision: fecha,
      moneda: fila.currency_code ?? 'PEN',
      clienteRazonSocial: fila.customer_legal_name ?? 'CLIENTE',
      clienteDocumento: fila.customer_identity_number,
      nombreTipo:
        NOMBRE_TIPO[fila.tipo_comprobante] ?? 'COMPROBANTE ELECTRÓNICO',
      lineas,
      gravado: gravadoR,
      exonerado: centimos(exonerado),
      inafecto: centimos(inafecto),
      igv,
      icbper,
      detraccion,
      total,
      montoEnLetras: String(payload['montoEnLetras'] ?? ''),
      qrBase64,
    };
  }
}
