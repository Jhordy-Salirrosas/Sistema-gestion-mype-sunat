/**
 * Transición terminal a la DLQ (HU-04).
 *
 * Se separa de `InvoiceRetryService` para que el orquestador de reintentos
 * quede por debajo del límite de líneas y para que la escritura transaccional
 * (Invoice + TransactionHistory) y el encolado en la DLQ tengan una sola
 * responsabilidad.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { InvoiceStatus } from '../../../../generated/client/enums';
import { ProcessCdrResult } from '../../../sunat/soap/sunatBillTypes';
import { QueueService } from './queue.service';

export interface EnviarADlqParams {
  invoiceId: string;
  intento: number;
  estadoAnterior: InvoiceStatus | null;
  ultimo: ProcessCdrResult | null;
  motivo: string;
}

@Injectable()
export class InvoiceDlqService {
  private readonly logger = new Logger(InvoiceDlqService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  /** Deja la Invoice en ERROR_RED, audita la transición y encola en la DLQ. */
  async enviar(params: EnviarADlqParams): Promise<string> {
    const { invoiceId, intento, estadoAnterior, ultimo, motivo } = params;
    const mensaje = `Reintentos agotados tras ${intento} intentos: ${motivo}`;

    const companyId = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: { estado: InvoiceStatus.ERROR_RED },
        select: { company_id: true },
      });

      await tx.transactionHistory.create({
        data: {
          company_id: invoice.company_id,
          invoice_id: invoiceId,
          intento,
          estado_anterior: estadoAnterior,
          estado_nuevo: InvoiceStatus.ERROR_RED,
          codigo_error: 'MAX_REINTENTOS',
          mensaje_error: mensaje,
          tiempo_respuesta_ms: ultimo?.tiempoRespuestaMs ?? null,
        },
      });

      return invoice.company_id;
    });

    const jobId = await this.queue.sendToDlq(invoiceId, companyId, {
      intento,
      codigo_error: 'MAX_REINTENTOS',
      mensaje_error: mensaje,
      estado: InvoiceStatus.ERROR_RED,
    });
    if (!jobId) {
      throw new Error(`No se pudo encolar ${invoiceId} en la DLQ.`);
    }

    this.logger.error(`[HU-04] ${invoiceId} enviado a la DLQ: ${mensaje}`);
    return mensaje;
  }
}
