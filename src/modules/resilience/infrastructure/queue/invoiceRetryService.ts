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
import {
  requiereConciliacion,
  resultadoTrasConciliacion,
} from '../../../invoices/application/services/invoiceReconciliation';
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

/**
 * Contrato mínimo de la consulta de estado (TA-30).
 *
 * Se declara aquí y no se importa de la implementación para que esta rama
 * (TA-32) no dependa de la rama de TA-30: mientras no se inyecte nada, el
 * servicio funciona como antes. El token de inyección es
 * `CONSULTA_ESTADO_PORT`.
 */
export const CONSULTA_ESTADO_PORT = Symbol('CONSULTA_ESTADO_PORT');

/** Parámetros para preguntar a SUNAT por un comprobante ya enviado. */
export interface ConsultaEstadoParams {
  invoiceId: string;
  rucEmisor: string;
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  estadoActual: InvoiceStatus | null;
  intento: number;
}

export interface ConsultaEstadoPort {
  /** Devuelve el resultado recuperado, o `null` si SUNAT no lo tiene. */
  consultarEstado(
    params: ConsultaEstadoParams,
  ): Promise<ProcessCdrResult | null>;
}

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
    // TA-32: opcional a propósito. Si no está (rama de TA-30 sin integrar),
    // no se concilia y el reintento se comporta como antes.
    @Optional()
    @Inject(CONSULTA_ESTADO_PORT)
    private readonly consultaEstado?: ConsultaEstadoPort,
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

      // TA-32 criterio 3: si el intento anterior quedó en estado incierto
      // (timeout), se reconcilia con SUNAT ANTES de volver a enviar. Si SUNAT
      // ya tenía el comprobante, su CDR se recupera y no se reenvía nada.
      const conciliado = await this.conciliar(job, ultimo);
      if (conciliado) {
        return this.resultado(job.invoiceId, conciliado, intento, false, false);
      }

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

  /**
   * TA-32, frente 2: concilia un intento que quedó en estado incierto.
   *
   * Antes de reenviar un comprobante cuyo timeout pudo haber llegado a SUNAT,
   * se pregunta por su estado. Si SUNAT lo tenía, se devuelve el CDR
   * recuperado y el proceso termina sin reenviar; si no lo tenía (o la
   * consulta tampoco respondió), devuelve null y el flujo sigue al reintento.
   *
   * La consulta es OPCIONAL a propósito: en la rama de TA-32 todavía no existe
   * el servicio de consulta (llega con TA-30). Sin él, el comportamiento es el
   * anterior, así que las dos ramas se pueden integrar en cualquier orden.
   */
  private async conciliar(
    job: RetryInvoiceJob,
    ultimo: ProcessCdrResult | null,
  ): Promise<ProcessCdrResult | null> {
    if (!this.consultaEstado) return null;
    if (!requiereConciliacion(ultimo, null)) return null;

    try {
      const consultado = await this.consultaEstado.consultarEstado({
        invoiceId: job.invoiceId,
        rucEmisor: job.rucEmisor,
        tipoComprobante: job.tipoComprobante,
        serie: job.serie,
        correlativo: job.correlativo,
        estadoActual: ultimo?.estado ?? null,
        intento: ultimo ? 1 : 1,
      });

      const recuperado = resultadoTrasConciliacion(consultado);
      if (recuperado) {
        this.logger.warn(
          `[TA-32] ${job.invoiceId}: SUNAT ya había procesado el comprobante; se recupera el CDR (${recuperado.responseCode}) sin reenviar`,
        );
      }
      return recuperado;
    } catch (error) {
      // Si la conciliación falla se sigue con el reintento: es el
      // comportamiento previo y nunca peor que quedarse sin hacer nada.
      this.logger.warn(
        `[TA-32] ${job.invoiceId}: no se pudo conciliar el estado (${this.mensajeDe(error)}); se reintenta el envío`,
      );
      return null;
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
