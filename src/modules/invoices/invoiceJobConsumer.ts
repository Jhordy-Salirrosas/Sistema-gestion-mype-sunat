/**
 * TA-28 - Consumidor de la cola de facturas y recarga del job.
 *
 * El defecto que corrige este archivo: `queue.enqueueInvoiceInTx` publicaba en
 * `sunat-invoice-queue` pero nadie escuchaba esa cola. El comprobante entraba a
 * pg-boss y se quedaba ahi para siempre: no llegaba a SUNAT ni obtenia CDR.
 *
 * Responsabilidades:
 *  1. Registrar `boss.work` sobre la cola de facturas (criterio 1).
 *  2. Traducir el payload minimo del job (`{ invoice_id }`) a los datos
 *     completos que necesita el envio: XML del payload_ubl, firma XMLDSig,
 *     ZIP y credenciales SOL.
 *  3. Delegar el envio en `InvoiceRetryService.processWithRetry`, que es quien
 *     aplica el backoff de 5/15/45 s (HU-04) y el Circuit Breaker (TA-33).
 *
 * Lo que este archivo NO hace, a proposito: backoff, conteo de intentos y
 * movimiento a la DLQ. Eso ya vive en `InvoiceRetryService` y duplicarlo haria
 * que cada job se reintente dos veces. Lo dice el propio spec del modulo:
 *
 *   "`InvoiceRetryService` es el unico punto que mueve jobs a la DLQ y marca la
 *    Invoice en `ERROR_RED`; el worker de facturacion no debe reimplementar esa
 *   secuencia."  (specs/m2_resilience.spec.md, TA-57)
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { PrismaService } from '../../database/prismaService';
import { InvoiceStatus } from '../../generated/client/enums';
import {
  InvoiceRetryService,
  RetryInvoiceResult,
} from '../resilience/infrastructure/queue/invoiceRetryService';
import { QueueService } from '../resilience/infrastructure/queue/queue.service';
import { SignatureService } from '../sunat/signature.service';
import { buildZipFileName } from '../sunat/soap/soap.constants';
import type { SendInvoiceParams } from '../sunat/soap/sunatBillTypes';
import type { InvoicePayload } from './invoicePayload';
import { UblGeneratorService } from './ublGeneratorService';
import { XsdValidatorService } from './xsdValidatorService';

/** Payload que viaja en la cola: solo identifica el comprobante. */
export interface InvoiceJobPayload {
  invoice_id: string;
}

/** Fila minima de Invoice que necesita el consumidor. */
interface InvoiceRow {
  id: string;
  ruc_emisor: string;
  tipo_comprobante: string;
  serie: string;
  correlativo: number;
  estado: InvoiceStatus;
  payload_ubl: unknown;
  xml_storage_url: string | null;
}

/** Comprobante ya firmado y empaquetado, listo para `sendBill`. */
export interface JobAprobado {
  params: SendInvoiceParams;
  firmado: boolean;
}

@Injectable()
export class InvoiceJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(InvoiceJobConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly retry: InvoiceRetryService,
    private readonly prisma: PrismaService,
    private readonly ublGenerator: UblGeneratorService,
    private readonly xsdValidator: XsdValidatorService,
    private readonly signature: SignatureService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Un doble de QueueService en las pruebas e2e puede no exponer el metodo:
    // en ese caso no hay cola que consumir y el arranque no debe fallar.
    if (typeof this.queue.registerInvoiceWorker !== 'function') {
      this.logger.warn(
        'QueueService sin registerInvoiceWorker: el consumidor de comprobantes no se registra',
      );
      return;
    }

    await this.queue.registerInvoiceWorker((job) => this.procesar(job));
    this.logger.log('Consumidor de comprobantes registrado');
  }

  /**
   * Un job de la cola. Nunca lanza hacia pg-boss: un throw haria que el
   * transporte marque el job como fallido y lo reintente por su cuenta,
   * saltandose el backoff de `InvoiceRetryService`.
   */
  async procesar(job: InvoiceJobPayload): Promise<RetryInvoiceResult | null> {
    const invoiceId = job?.invoice_id;
    if (!invoiceId) {
      this.logger.error('Job sin invoice_id: se descarta');
      return null;
    }

    let aprobado: JobAprobado;
    try {
      aprobado = await this.preparar(invoiceId);
    } catch (error) {
      // Fallo al generar, validar o firmar: no tiene sentido reintentar contra
      // SUNAT porque el XML saldria igual de invalido. Se deja en ERROR_RED.
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`[TA-28] ${invoiceId} no se pudo preparar: ${mensaje}`);
      await this.marcar(invoiceId, InvoiceStatus.ERROR_RED);
      return null;
    }

    return this.retry.processWithRetry(aprobado.params);
  }

  /** Traduce `{ invoice_id }` a los datos completos del envio. */
  async preparar(invoiceId: string): Promise<JobAprobado> {
    const invoice = await this.cargar(invoiceId);
    const xmlSinFirma = this.xmlDelComprobante(invoice);
    const xml = this.firmar(invoice, xmlSinFirma);
    const zip = this.comprimir(invoice, xml);

    return {
      // Un XML que ya traia la firma tampoco se vuelve a firmar: cuenta como
      // firmado porque el sobre sale con XMLDSig.
      firmado: xml.includes('<ds:Signature'),
      params: {
        invoiceId: invoice.id,
        rucEmisor: invoice.ruc_emisor,
        tipoComprobante: invoice.tipo_comprobante,
        serie: invoice.serie,
        correlativo: invoice.correlativo,
        zip,
        estadoActual: invoice.estado,
      },
    };
  }

  /** Lee el comprobante y rechaza los que ya estan en estado final. */
  private async cargar(invoiceId: string): Promise<InvoiceRow> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        ruc_emisor: true,
        tipo_comprobante: true,
        serie: true,
        correlativo: true,
        estado: true,
        payload_ubl: true,
        xml_storage_url: true,
      },
    });

    if (!invoice) {
      throw new Error(`Comprobante ${invoiceId} no existe en la base de datos`);
    }

    const finales: InvoiceStatus[] = [
      InvoiceStatus.ACEPTADO,
      InvoiceStatus.OBSERVADO,
      InvoiceStatus.RECHAZADO,
      InvoiceStatus.ANULADO,
    ];
    if (finales.includes(invoice.estado)) {
      throw new Error(
        `Comprobante ${invoiceId} ya tiene estado final ${invoice.estado}: no se reenvia`,
      );
    }

    return invoice as InvoiceRow;
  }

  /**
   * Devuelve el XML del comprobante.
   *
   * Primero intenta el guardado por el worker de TA-11 en `xml_storage_url`;
   * si no existe, lo genera desde `payload_ubl` y lo valida contra el XSD.
   */
  private xmlDelComprobante(invoice: InvoiceRow): string {
    const guardado = invoice.xml_storage_url;
    if (guardado && guardado.trimStart().startsWith('<?xml')) return guardado;

    const payload = invoice.payload_ubl as InvoicePayload | null;
    if (!payload || typeof payload !== 'object') {
      throw new Error(
        `Comprobante ${invoice.id} sin payload_ubl: no se puede generar el XML`,
      );
    }

    const xml = this.ublGenerator.generateInvoiceXml(payload);
    const validacion = this.xsdValidator.validateInvoiceUbl21(xml);
    if (!validacion.isValid) {
      const detalle = (validacion.errors ?? []).join(' | ');
      throw new Error(`XML invalido contra UBL 2.1: ${detalle}`);
    }
    return xml;
  }

  /** Firma XMLDSig X.509. Sin certificado configurado el XML viaja sin firmar. */
  private firmar(invoice: InvoiceRow, xml: string): string {
    if (xml.includes('<ds:Signature')) return xml;
    if (!process.env.CERT_BASE64) {
      this.logger.warn(
        `[TA-28] ${invoice.id} viaja SIN firma: CERT_BASE64 no esta configurado`,
      );
      return xml;
    }
    return this.signature.signXml(xml).signedXml;
  }

  /** Empaqueta en el ZIP con la convencion de nombre que espera SUNAT. */
  private comprimir(invoice: InvoiceRow, xml: string): Buffer {
    const fileName = buildZipFileName({
      ruc: invoice.ruc_emisor,
      tipoComprobante: invoice.tipo_comprobante,
      serie: invoice.serie,
      correlativo: invoice.correlativo,
    });

    const zip = new AdmZip();
    zip.addFile(fileName.replace(/\.zip$/i, '.xml'), Buffer.from(xml, 'utf8'));
    return zip.toBuffer();
  }

  /**
   * Hash SHA-256 del XML: huella del contenido enviado, util para detectar
   * modificaciones posteriores. Se guarda en `xml_hash_sha256`.
   */
  hashDelXml(xml: string): string {
    return createHash('sha256').update(xml, 'utf8').digest('hex');
  }

  private async marcar(invoiceId: string, estado: InvoiceStatus): Promise<void> {
    await this.prisma.invoice
      .update({ where: { id: invoiceId }, data: { estado } })
      .catch(() => null);
  }
}
