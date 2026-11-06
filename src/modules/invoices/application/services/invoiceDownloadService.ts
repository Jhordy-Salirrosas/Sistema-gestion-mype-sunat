import {
  IssuerConfigResolver,
  type IssuerContext,
} from '../../../sunat/issuerConfigResolver';
import { Optional } from '@nestjs/common';
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
 *  - **Si hay que regenerarlo, se firma.** Un XML reconstruido sin
 *    `<ds:Signature>` no es un comprobante electrónico: es un borrador. Un
 *    comprobante aceptado por SUNAT NO se pudo enviar sin firma, así que
 *    entregarlo sin firma contradice el propio estado del documento. El
 *    fallback firma, y si no hay certificado disponible responde 500 con el
 *    motivo en vez de entregar un archivo que parece válido y no lo es.
 *  - **El CDR se devuelve tal cual llegó.** El XML del CDR es el documento
 *    probatorio; no se reformatea ni se reindenta.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { UblGeneratorService } from '../../ublGeneratorService';
import { SignatureService } from '../../../sunat/signature.service';
import { SignedXmlStorageService } from './signedXmlStorageService';
import type { InvoicePayload } from '../../invoicePayload';
import {
  InvoicePdfService,
  type DatosPdfComprobante,
  type FormatoPdf,
  type LineaImpresa,
} from './invoicePdfService';
import { InvoiceQrService } from './invoiceQrService';
import { importeEnLetras } from './importeEnLetras';

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
    private readonly signature: SignatureService,
    private readonly xmlFirmadoGuardado: SignedXmlStorageService,
    @Optional() private readonly issuerConfig?: IssuerConfigResolver,
  ) {}

  /**
   * Devuelve el archivo solicitado o lanza 404 si no corresponde.
   *
   * @param formato Solo aplica al PDF: `a4` (por defecto) o `ticket80mm` para
   *   la impresora térmica de mostrador.
   */
  public async descargar(
    companyId: string,
    invoiceId: string,
    tipo: TipoDescarga,
    formato: FormatoPdf = 'a4',
  ): Promise<ArchivoDescarga> {
    const fila = await this.cargar(companyId, invoiceId);

    if (tipo === 'xml')
      return this.xml(fila, await this.issuerConfig?.resolve(companyId));
    if (tipo === 'cdr') return this.cdr(fila);
    return this.pdfDelComprobante(fila, formato);
  }

  /**
   * XML del comprobante, SIEMPRE firmado.
   *
   * Dos caminos:
   *
   *  1. **Guardado** (`xml_storage_url`): es el que firmó el worker y viajó a
   *     SUNAT. Se entrega tal cual, sin volver a firmar: una segunda firma
   *     produciría un documento distinto del aceptado.
   *  2. **Regenerado**: los comprobantes emitidos ANTES de que existiera el
   *     guardado no tienen copia. Regenerarlos sin firma entregaba un documento
   *     que SUNAT no habría aceptado nunca. Aquí se regenera y se firma con el
   *     mismo `SignatureService` del worker, y el resultado se guarda para que
   *     la siguiente descarga ya tome el camino 1.
   *
   * La firma NO es idéntica a la original (incluye una marca de tiempo en el
   * `SignatureValue`), pero es criptográficamente válida sobre el mismo
   * contenido: es un comprobante firmado por el emisor, no una reconstrucción.
   */
  private async xml(
    fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>,
    context?: IssuerContext,
  ): Promise<ArchivoDescarga> {
    const guardado = fila.xml_storage_url;
    const esXml = guardado && guardado.trimStart().startsWith('<?xml');

    let texto: string;
    if (esXml) {
      texto = guardado;
    } else {
      texto = this.regenerarXmlFirmado(fila, context);
      // Se persiste para no volver a firmar en cada descarga. El servicio de
      // guardado nunca lanza: si la base falla, se entrega el XML firmado
      // igualmente y solo se pierde la caché.
      await this.xmlFirmadoGuardado.guardar(fila.id, texto);
    }

    return {
      nombre: `${this.nombreBase(fila)}.xml`,
      contentType: 'application/xml; charset=utf-8',
      contenido: Buffer.from(texto, 'utf8'),
    };
  }

  /**
   * Regenera el XML desde `payload_ubl` y lo firma.
   *
   * SIN FIRMA NO SE ENTREGA. Si el certificado no está disponible, se propaga
   * el error en vez de devolver un XML sin `<ds:Signature>`: un archivo así
   * parece válido, se descarga con el nombre correcto y no lo es. Un error
   * visible es preferible a un documento silenciosamente incompleto.
   */
  private regenerarXmlFirmado(
    fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>,
    context?: IssuerContext,
  ): string {
    const payload = fila.payload_ubl as unknown as InvoicePayload | null;
    if (!payload || typeof payload !== 'object') {
      throw new NotFoundException(
        'El comprobante no tiene XML guardado ni payload para regenerarlo.',
      );
    }

    const sinFirma = this.ublGenerator.generateInvoiceXml(payload);

    this.logger.warn(
      `Comprobante ${fila.serie}-${fila.correlativo} sin XML guardado: ` +
        'se regenera y se firma antes de entregarlo',
    );

    return this.signature.signXml(sinFirma, context).signedXml;
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

  /**
   * Nombre del archivo según la convención de SUNAT.
   *
   * El correlativo va con 8 dígitos, igual que el `cbc:ID` del XML y que el
   * nombre del ZIP que se envió: 20601234567-01-F001-00000032.xml. Antes el PDF
   * salía con 8 dígitos y el XML sin relleno (F001-32), así que el mismo
   * comprobante se descargaba con dos nombres distintos.
   */
  private nombreBase(fila: {
    ruc_emisor: string;
    tipo_comprobante: string;
    serie: string;
    correlativo: number;
  }): string {
    const correlativo = String(fila.correlativo).padStart(8, '0');
    return `${fila.ruc_emisor}-${fila.tipo_comprobante}-${fila.serie}-${correlativo}`;
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
  private cdr(
    fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>,
  ): ArchivoDescarga {
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
    formato: FormatoPdf = 'a4',
  ): Promise<ArchivoDescarga> {
    const datos = await this.datosPdf(fila);
    const contenido = await this.pdf.generar(datos, formato);

    return {
      nombre: this.pdf.nombreArchivo(datos, formato),
      contentType: 'application/pdf',
      contenido,
    };
  }

  /** Liquida los importes a partir de los ítems GUARDADOS. */
  private async datosPdf(
    fila: Awaited<ReturnType<InvoiceDownloadService['cargar']>>,
  ): Promise<DatosPdfComprobante> {
    const gratuitas = new Set([
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '21',
      '31',
      '32',
      '33',
      '34',
      '35',
      '36',
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

    const payload = (fila.payload_ubl ?? {}) as Record<string, unknown>;
    const detraccion = Number(payload['montoDetraccion'] ?? 0) || 0;

    // El ICBPER es el impuesto a las bolsas plásticas, NO el IGV. Antes se
    // sumaba `igv_amount` de todas las líneas, así que una boleta de S/ 100 sin
    // bolsas imprimía "ICBPER 18.00" y el total se iba a S/ 136. El importe real
    // de las bolsas solo existe en el payload cuando se emitieron.
    const icbper = centimos(
      Number(payload['icbper'] ?? payload['montoIcbper'] ?? 0) || 0,
    );
    const total = centimos(gravadoR + igv + exonerado + inafecto + icbper);

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
      razonSocialEmisor: String(
        payload['razonSocialEmisor'] ?? 'EMPRESA EMISORA',
      ),
      direccionEmisor: payload['direccionEmisor'] as string | undefined,
      tipoComprobante: fila.tipo_comprobante,
      serie: fila.serie,
      correlativo: fila.correlativo,
      fechaEmision: fecha,
      moneda: fila.currency_code ?? 'PEN',
      clienteRazonSocial: fila.customer_legal_name ?? 'CLIENTE',
      clienteDocumento: fila.customer_identity_number ?? '',
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
      montoEnLetras:
        String(payload['montoEnLetras'] ?? '') || importeEnLetras(total),
      qrBase64,
    };
  }
}
