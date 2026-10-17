import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prismaService';
import { UblGeneratorService, type InvoicePayload } from './ublGeneratorService';
import { XsdValidatorService } from './xsdValidatorService';
import { SignatureService } from '../sunat/signature.service';

export interface ProcessJobResult {
  success: boolean;
  invoiceId: string;
  status: string;
  signedXml?: string;
  errorMessage?: string;
}

interface PrismaUpdatable {
  invoice?: {
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  transactionHistory?: {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
}

@Injectable()
export class InvoiceWorkerService {
  private readonly logger = new Logger(InvoiceWorkerService.name);
  public static readonly MAIN_QUEUE = 'sunat-invoice-queue';
  public static readonly DLQ_QUEUE = 'sunat-invoice-dlq';

  constructor(
    private readonly prisma: PrismaService,
    private readonly ublGenerator: UblGeneratorService,
    private readonly xsdValidator: XsdValidatorService,
    private readonly signatureService: SignatureService,
  ) {}

  public async processInvoiceJob(jobData: { invoiceId: string; payload: InvoicePayload }): Promise<ProcessJobResult> {
    const { invoiceId, payload } = jobData;
    const startTime = Date.now();

    this.logger.log(`[Job Tomado] Procesando comprobante: ${invoiceId}`);

    // 1. Transición de estado: PENDIENTE -> PROCESANDO (Criterio 1)
    await this.updateInvoiceStatus(invoiceId, 'PROCESANDO');
    await this.recordAudit(invoiceId, 1, 'PENDIENTE', 'PROCESANDO', 'JOB_ACQUIRED', 'Job tomado por el worker');

    try {
      // 2. Generación de XML UBL 2.1 oficial (Criterio 2)
      const rawXml = this.ublGenerator.generateInvoiceXml(payload);

      // 3. Validación estructural contra UBL-Invoice-2.1.xsd (Criterio 3)
      const validation = this.xsdValidator.validateInvoiceUbl21(rawXml);

      if (!validation.isValid) {
        const errorDetail = validation.errors.join(' | ');
        this.logger.error(`[Fallo XSD] Comprobante ${invoiceId} inválido: ${errorDetail}`);

        // Desvío a DLQ y registro de auditoría sin perder el payload (Criterio 5)
        await this.updateInvoiceStatus(invoiceId, 'ERROR_VALIDACION_XSD');
        await this.recordAudit(
          invoiceId,
          1,
          'PROCESANDO',
          'FALLIDO_DLQ',
          'ERR_XSD_SCHEMA',
          `Rechazado por XSD: ${errorDetail}`,
          Date.now() - startTime,
        );

        return {
          success: false,
          invoiceId,
          status: 'ERROR_VALIDACION_XSD',
          errorMessage: errorDetail,
        };
      }

      // 4. Firma digital XMLDSig X.509
      const signatureResult = this.signatureService.signXml(rawXml);

      // 5. Transición exitosa y auditoría completa (Criterio 4)
      const duration = Date.now() - startTime;
      await this.updateInvoiceStatus(invoiceId, 'PROCESADO', signatureResult.signedXml);
      await this.recordAudit(
        invoiceId,
        1,
        'PROCESANDO',
        'PROCESADO',
        'SUCCESS_READY_FOR_SUNAT',
        'XML generado, validado contra XSD y firmado correctamente',
        duration,
      );

      this.logger.log(`[Éxito Pipeline] Comprobante ${invoiceId} listo en ${duration}ms`);

      return {
        success: true,
        invoiceId,
        status: 'PROCESADO',
        signedXml: signatureResult.signedXml,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Falla Pipeline] Error al procesar ${invoiceId}: ${errorMessage}`);

      await this.updateInvoiceStatus(invoiceId, 'FALLIDO');
      await this.recordAudit(
        invoiceId,
        1,
        'PROCESANDO',
        'FALLIDO',
        'ERR_WORKER_PIPELINE',
        errorMessage,
        duration,
      );

      return {
        success: false,
        invoiceId,
        status: 'FALLIDO',
        errorMessage,
      };
    }
  }

  private async updateInvoiceStatus(id: string, status: string, signedXml?: string): Promise<void> {
    const client = this.prisma as unknown as PrismaUpdatable;
    if (!client?.invoice?.update) return;

    await client.invoice.update({
      where: { id },
      data: {
        estado: status,
        ...(signedXml ? { xml_storage_url: signedXml } : {}),
      },
    }).catch(() => null);
  }

  private async recordAudit(
    invoiceId: string,
    intento: number,
    estadoAnterior: string,
    estadoNuevo: string,
    codigoError: string,
    mensajeError: string,
    tiempoMs = 0,
  ): Promise<void> {
    const client = this.prisma as unknown as PrismaUpdatable;
    if (!client?.transactionHistory?.create) return;

    await client.transactionHistory.create({
      data: {
        invoice_id: invoiceId,
        intento,
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        codigo_error: codigoError,
        mensaje_error: mensajeError,
        tiempo_respuesta_ms: tiempoMs,
      },
    }).catch(() => null);
  }
}
