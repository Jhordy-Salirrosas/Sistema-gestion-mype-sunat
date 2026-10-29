/**
 * Orquestador de reintentos (HU-04) + Circuit Breaker (TA-33).
 *
 * 3 reintentos de 5/15/45 s solo para fallos reintentables. Si el circuito
 * está OPEN no toca SUNAT y deja el job en cola; al agotar, ERROR_RED + DLQ.
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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
import { ResilienceStateService } from '../../application/resilienceStateService';
import { InvoiceDlqService } from './invoiceDlqService';

/** Token de inyección del reloj, para no esperar 65 s en las pruebas. */
export const RETRY_SLEEP = Symbol('RETRY_SLEEP');

/** Función de espera; en producción es `setTimeout`, en pruebas un doble. */
export type SleepFn = (ms: number) => Promise<void>;

/** Espera real entre reintentos. */
export const dormir: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Datos completos del comprobante que necesita el envío. */
export type RetryInvoiceJob = SendInvoiceParams;

export interface RetryInvoiceResult {
  invoiceId: string;
  estado: InvoiceStatus;
  intentos: number;
  reintentable: boolean;
  enviadoADlq: boolean;
  /** true: el circuito estaba OPEN y el job debe quedar en cola. */
  circuitoAbierto: boolean;
  ultimoResultado: ProcessCdrResult | null;
  error: string | null;
}

@Injectable()
export class InvoiceRetryService {
  private readonly logger = new Logger(InvoiceRetryService.name);

  constructor(
    private readonly dlq: InvoiceDlqService,
    private readonly sunatBill: SunatBillService,
    private readonly state: ResilienceStateService,
    @Optional() @Inject(RETRY_SLEEP) private readonly sleep: SleepFn = dormir,
  ) {}

  /** Ejecuta el envío con reintentos; nunca lanza por un fallo de SUNAT. */
  async processWithRetry(job: RetryInvoiceJob): Promise<RetryInvoiceResult> {
    let estadoAnterior: InvoiceStatus | null =
      job.estadoActual ?? InvoiceStatus.PENDIENTE;
    let ultimo: ProcessCdrResult | null = null;
    for (let intento = 1; ; intento += 1) {
      // TA-33: con el circuito OPEN no se toca la red. El job no se marca
      // terminado ni va a la DLQ: queda en cola para cuando SUNAT se recupere.
      if (!this.state.reservarEnvio()) {
        return this.detenerPorCircuito(
          job,
          intento - 1,
          estadoAnterior,
          ultimo,
        );
      }

      try {
        ultimo = await this.sunatBill.sendAndProcess({
          ...job,
          intento,
          estadoActual: estadoAnterior,
        });
      } catch (error) {
        // Fallo inesperado (p. ej. no se pudo persistir el CDR): no se
        // reenvía a ciegas; el comprobante queda terminal y va a la DLQ.
        this.state.liberarEnvio();
        const mensaje = this.mensajeDe(error);
        this.logger.error(
          `[HU-04] Envío ${job.invoiceId} intento ${intento} falló sin resultado: ${mensaje}`,
        );
        return this.terminarEnDlq(job, intento, estadoAnterior, ultimo, mensaje);
      }

      estadoAnterior = ultimo.estado;
      // TA-33: los reintentables (red, timeout, 5xx, CDR ilegible) alimentan
      // el circuito; un CDR de negocio demuestra que SUNAT responde y lo cierra.
      this.state.registrarResultadoEnvio(ultimo.reintentable);

      const decision = decidirReintento(ultimo, intento);

      if (decision === 'DETENER') {
        this.logger.warn(
          `[HU-04] ${job.invoiceId} no se reintenta: ${ultimo.error ?? 'rechazo de negocio del CDR'}`,
        );
        return this.resultado(job.invoiceId, ultimo, intento, false, false);
      }

      if (decision === 'DLQ') {
        return this.terminarEnDlq(
          job,
          intento,
          estadoAnterior,
          ultimo,
          ultimo.error ?? 'Se agotaron los reintentos',
        );
      }

      // Si este intento abrió el circuito, no se espera el backoff: el job
      // queda en cola y el worker lo retomará cuando pase la ventana.
      if (!this.state.puedeEnviar()) {
        return this.detenerPorCircuito(job, intento, estadoAnterior, ultimo);
      }

      const retardo = delayDelReintento(intento);
      this.logger.warn(
        `[HU-04] ${job.invoiceId} intento ${intento} falló; reintento en ${retardo} ms`,
      );
      await this.sleep(retardo);
    }
  }

  /** Devuelve el job sin tocarlo: el Circuit Breaker está OPEN. */
  private detenerPorCircuito(
    job: RetryInvoiceJob,
    intentos: number,
    estadoAnterior: InvoiceStatus | null,
    ultimo: ProcessCdrResult | null,
  ): RetryInvoiceResult {
    const mensaje =
      'Circuit Breaker OPEN: el job queda en cola sin tocar SUNAT';
    this.logger.warn(`[TA-33] ${job.invoiceId}: ${mensaje}`);

    return {
      invoiceId: job.invoiceId,
      estado: estadoAnterior ?? InvoiceStatus.PENDIENTE,
      intentos,
      reintentable: true,
      enviadoADlq: false,
      circuitoAbierto: true,
      ultimoResultado: ultimo,
      error: mensaje,
    };
  }
  /** Deja la Invoice en ERROR_RED y mueve el job a la DLQ. */
  private async terminarEnDlq(
    job: RetryInvoiceJob,
    intento: number,
    estadoAnterior: InvoiceStatus | null,
    ultimo: ProcessCdrResult | null,
    motivo: string,
  ): Promise<RetryInvoiceResult> {
    const mensaje = await this.dlq.enviar({
      invoiceId: job.invoiceId,
      intento,
      estadoAnterior,
      ultimo,
      motivo,
    });

    return {
      invoiceId: job.invoiceId,
      estado: InvoiceStatus.ERROR_RED,
      intentos: intento,
      reintentable: false,
      enviadoADlq: true,
      circuitoAbierto: false,
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
      circuitoAbierto: false,
      ultimoResultado: ultimo,
      error: ultimo.error,
    };
  }

  private mensajeDe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
