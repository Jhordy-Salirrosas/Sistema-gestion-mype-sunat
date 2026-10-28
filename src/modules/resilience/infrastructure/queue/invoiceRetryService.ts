/**
 * Orquestador de reintentos del envío de comprobantes (HU-04, M2).
 *
 * Aplica `backoffPolicy`: 3 reintentos (5, 15 y 45 s) solo para fallos
 * reintentables (red, timeout, 5xx o CDR ilegible). Un rechazo de negocio del
 * CDR no se reintenta. Al agotar los reintentos deja la Invoice en `ERROR_RED`,
 * registra la transición terminal y mueve el job a `sunat-invoice-dlq`.
 *
 * Cada intento lo audita `SunatBillService`/`CdrPersistenceService` en
 * `TransactionHistory`. El consumidor de pg-boss (TA-57) es quien debe invocar
 * `processWithRetry`; este servicio no genera el XML ni arma el ZIP.
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { InvoiceStatus } from '../../../../generated/client/enums';
import { SunatBillService } from '../../../sunat/sunat-bill.service';
import {
  ProcessCdrResult,
  SendInvoiceParams,
} from '../../../sunat/soap/sunatBillTypes';
import {
  decidirReintento,
  delayDelReintento,
} from '../../domain/rules/backoffPolicy';
import { QueueService } from './queue.service';

/** Token de inyección del reloj, para no esperar 65 s en las pruebas. */
export const RETRY_SLEEP = Symbol('RETRY_SLEEP');

/** Función de espera; en producción es `setTimeout`, en pruebas un doble. */
export type SleepFn = (ms: number) => Promise<void>;

/** Espera real entre reintentos. */
export const dormir: SleepFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Datos completos del comprobante que necesita el envío. */
export type RetryInvoiceJob = SendInvoiceParams;

export interface RetryInvoiceResult {
  invoiceId: string;
  estado: InvoiceStatus;
  intentos: number;
  reintentable: boolean;
  enviadoADlq: boolean;
  ultimoResultado: ProcessCdrResult | null;
  error: string | null;
}

@Injectable()
export class InvoiceRetryService {
  private readonly logger = new Logger(InvoiceRetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly sunatBill: SunatBillService,
    @Optional() @Inject(RETRY_SLEEP) private readonly sleep: SleepFn = dormir,
  ) {}

  /**
   * Ejecuta el envío con reintentos. Nunca lanza por un fallo de SUNAT: el
   * resultado describe el estado final. Solo un fallo al escribir la DLQ o al
   * auditar la transición terminal puede propagarse (el job no debe perderse).
   */
  async processWithRetry(job: RetryInvoiceJob): Promise<RetryInvoiceResult> {
    let estadoAnterior: InvoiceStatus | null =
      job.estadoActual ?? InvoiceStatus.PENDIENTE;
    let ultimo: ProcessCdrResult | null = null;

    for (let intento = 1; ; intento += 1) {
      try {
        ultimo = await this.sunatBill.sendAndProcess({
          ...job,
          intento,
          estadoActual: estadoAnterior,
        });
      } catch (error) {
        // Fallo inesperado (p. ej. no se pudo persistir el CDR): no se
        // reenvía a ciegas; el comprobante queda terminal y va a la DLQ.
        const mensaje = this.mensajeDe(error);
        this.logger.error(
          `[HU-04] Envío ${job.invoiceId} intento ${intento} falló sin resultado: ${mensaje}`,
        );
        return this.enviarADlq(job, intento, estadoAnterior, ultimo, mensaje);
      }

      estadoAnterior = ultimo.estado;
      const decision = decidirReintento(ultimo, intento);

      if (decision === 'DETENER') {
        this.logger.warn(
          `[HU-04] ${job.invoiceId} no se reintenta: ${ultimo.error ?? 'rechazo de negocio del CDR'}`,
        );
        return this.resultado(job.invoiceId, ultimo, intento, false, false);
      }

      if (decision === 'DLQ') {
        return this.enviarADlq(
          job,
          intento,
          estadoAnterior,
          ultimo,
          ultimo.error ?? 'Se agotaron los reintentos',
        );
      }

      const retardo = delayDelReintento(intento);
      this.logger.warn(
        `[HU-04] ${job.invoiceId} intento ${intento} falló; reintento en ${retardo} ms`,
      );
      await this.sleep(retardo);
    }
  }

  /**
   * Transición terminal: Invoice -> ERROR_RED + fila de auditoría, y el job a
   * la DLQ. La fila de cada intento ya la escribió `CdrPersistenceService`;
   * esta registra el paso final a la cola de muertos.
   */
  private async enviarADlq(
    job: RetryInvoiceJob,
    intento: number,
    estadoAnterior: InvoiceStatus | null,
    ultimo: ProcessCdrResult | null,
    motivo: string,
  ): Promise<RetryInvoiceResult> {
    const mensaje = `Reintentos agotados tras ${intento} intentos: ${motivo}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: job.invoiceId },
        data: { estado: InvoiceStatus.ERROR_RED },
      });

      await tx.transactionHistory.create({
        data: {
          invoice_id: job.invoiceId,
          intento,
          estado_anterior: estadoAnterior,
          estado_nuevo: InvoiceStatus.ERROR_RED,
          codigo_error: 'MAX_REINTENTOS',
          mensaje_error: mensaje,
          tiempo_respuesta_ms: ultimo?.tiempoRespuestaMs ?? null,
        },
      });
    });

    await this.queue.sendToDlq(job.invoiceId, {
      intento,
      codigo_error: 'MAX_REINTENTOS',
      mensaje_error: mensaje,
      estado: InvoiceStatus.ERROR_RED,
    });

    this.logger.error(`[HU-04] ${job.invoiceId} enviado a la DLQ: ${mensaje}`);

    return {
      invoiceId: job.invoiceId,
      estado: InvoiceStatus.ERROR_RED,
      intentos: intento,
      reintentable: false,
      enviadoADlq: true,
      ultimoResultado: ultimo,
      error: mensaje,
    };
  }

  private resultado(
    invoiceId: string,
    ultimo: ProcessCdrResult,
    intentos: number,
    reintentable: boolean,
    enviadoADlq: boolean,
  ): RetryInvoiceResult {
    return {
      invoiceId,
      estado: ultimo.estado,
      intentos,
      reintentable,
      enviadoADlq,
      ultimoResultado: ultimo,
      error: ultimo.error,
    };
  }

  private mensajeDe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
