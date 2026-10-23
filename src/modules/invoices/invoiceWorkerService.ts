import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prismaService';
import { UblGeneratorService } from './ublGeneratorService';
import type { InvoicePayload } from './invoicePayload';
import { XsdValidatorService } from './xsdValidatorService';
import { SignatureService } from '../sunat/signature.service';
import {
  actualizarEstadoInvoice,
  registrarAuditoria,
} from './invoiceWorkerAudit';

export interface ProcessJobResult {
  success: boolean;
  invoiceId: string;
  status: string;
  signedXml?: string;
  errorMessage?: string;
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

  private actualizarEstado(id: string, status: string, xml?: string) {
    return actualizarEstadoInvoice(this.prisma, id, status, xml);
  }

  /** Registra una transición en el historial con el intento fijo del worker. */
  private auditar(
    invoiceId: string,
    anterior: string,
    nuevo: string,
    codigo: string,
    mensaje: string,
    tiempoMs = 0,
  ) {
    return registrarAuditoria(this.prisma, invoiceId, 1, anterior, nuevo, codigo, mensaje, tiempoMs);
  }

  public async processInvoiceJob(jobData: {
    invoiceId: string;
    payload: InvoicePayload;
  }): Promise<ProcessJobResult> {
    const { invoiceId, payload } = jobData;
    const startTime = Date.now();
    this.logger.log(`[Job Tomado] Procesando comprobante: ${invoiceId}`);

    // 1. Transición de estado: PENDIENTE -> PROCESANDO (Criterio 1)
    await this.actualizarEstado(invoiceId, 'PROCESANDO');
    await this.auditar(invoiceId, 'PENDIENTE', 'PROCESANDO', 'JOB_ACQUIRED', 'Job tomado por el worker');

    try {
      // 2. Generación de XML UBL 2.1 oficial (Criterio 2)
      const rawXml = this.ublGenerator.generateInvoiceXml(payload);

      // 3. Validación estructural contra UBL-Invoice-2.1.xsd (Criterio 3)
      const validation = this.xsdValidator.validateInvoiceUbl21(rawXml);

      if (!validation.isValid) {
        const errorDetail = validation.errors.join(' | ');
        this.logger.error(
          `[Fallo XSD] Comprobante ${invoiceId} inválido: ${errorDetail}`,
        );

        // Desvío a DLQ y auditoría sin perder el payload (Criterio 5)
        await this.actualizarEstado(invoiceId, 'ERROR_VALIDACION_XSD');
        await this.auditar(
          invoiceId,
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
      await this.actualizarEstado(
        invoiceId,
        'PROCESADO',
        signatureResult.signedXml,
      );
      await this.auditar(
        invoiceId,
        'PROCESANDO',
        'PROCESADO',
        'SUCCESS_READY_FOR_SUNAT',
        'XML generado, validado contra XSD y firmado correctamente',
        duration,
      );

      this.logger.log(
        `[Éxito Pipeline] Comprobante ${invoiceId} listo en ${duration}ms`,
      );

      return {
        success: true,
        invoiceId,
        status: 'PROCESADO',
        signedXml: signatureResult.signedXml,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[Falla Pipeline] Error al procesar ${invoiceId}: ${errorMessage}`,
      );

      await this.actualizarEstado(invoiceId, 'FALLIDO');
      await this.auditar(
        invoiceId,
        'PROCESANDO',
        'FALLIDO',
        'ERR_WORKER_PIPELINE',
        errorMessage,
        duration,
      );

      return { success: false, invoiceId, status: 'FALLIDO', errorMessage };
    }
  }
}
