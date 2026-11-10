/**
 * Orquestador de reintentos (HU-04) + Circuit Breaker (TA-33).
 *
 * 3 reintentos de 5/15/45 s solo para fallos reintentables. Si el circuito
 * está OPEN no toca SUNAT y deja el job en cola; al agotar, ERROR_RED + DLQ.
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
import { ResilienceStateService } from '../../application/resilienceStateService';
import {
  requiereConciliacion,
  type DesenlaceConciliacion,
} from '../../../invoices/application/services/invoiceReconciliation';
import { clasificarTransporte, CONSULTA_INCIERTA } from '../../../invoices/application/services/invoiceTransportEvidence';
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
 * El contrato estructurado se comparte con M1 sin depender de la implementación
 * SOAP. Sin consulta disponible, la incertidumbre sigue pendiente. El token es
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
  /** Distingue ausencia confirmada de consulta inconclusa, sin excepciones de negocio. */
  consultarEstado(
    params: ConsultaEstadoParams,
  ): Promise<DesenlaceConciliacion>;
}

export interface RetryInvoiceResult {
  invoiceId: string;
  estado: InvoiceStatus;
  intentos: number;
  reintentable: boolean;
  enviadoADlq: boolean;
  /** true: el circuito estaba OPEN y el job debe quedar en cola. */
  circuitoAbierto: boolean;
  incertidumbreTransporte?: boolean;
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
    // Sin puerto de consulta no se puede resolver un transporte incierto.
    @Optional()
    @Inject(CONSULTA_ESTADO_PORT)
    private readonly consultaEstado?: ConsultaEstadoPort,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  /** Ejecuta el envío con reintentos; nunca lanza por un fallo de SUNAT. */
  async processWithRetry(job: RetryInvoiceJob): Promise<RetryInvoiceResult> {
    let estadoAnterior: InvoiceStatus | null =
      job.estadoActual ?? InvoiceStatus.PENDIENTE;
    let ultimo: ProcessCdrResult | null = null;
    const anterior = await this.prisma?.invoice.findUnique({ where: { id: job.invoiceId }, select: { transport_uncertain: true, estado: true } });
    // null conserva desconocimiento histórico: ENVIADO/ERROR_RED exige consultar.
    let incierto = anterior?.transport_uncertain === true || (anterior?.transport_uncertain == null && ['ENVIADO', 'ERROR_RED'].includes(anterior?.estado ?? job.estadoActual ?? ''));
    if (incierto && this.prisma) {
      const history = await this.prisma.transactionHistory.findMany({ where: { invoice_id: job.invoiceId }, orderBy: { created_at: 'asc' } });
      if (clasificarTransporte(history) === 'BLOQUEO_PREVIO_PROBADO') {
        await this.incertidumbre(job.invoiceId, false);
        incierto = false;
      }
    }
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
        if (incierto) {
          const consulta = await this.consultarAntesDeReenviar(job, intento);
          if (consulta.tipo !== 'NO_ENCONTRADO') {
            this.state.liberarEnvio();
            if (consulta.tipo === 'INCIERTO') return this.pendientePorIncertidumbre(job, estadoAnterior, intento - 1, ultimo, consulta.motivo);
            return this.resultado(job.invoiceId, consulta.resultado, intento - 1, false, false);
          }
        }
        // Commit previo a abrir red: una caída del proceso también queda incierta.
        await this.incertidumbre(job.invoiceId, true);
        incierto = true;
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

      incierto = requiereConciliacion(ultimo, null);
      if (!incierto) await this.incertidumbre(job.invoiceId, false);
      estadoAnterior = ultimo.estado;
      // TA-33: los reintentables (red, timeout, 5xx, CDR ilegible) alimentan
      // el circuito; un CDR de negocio demuestra que SUNAT responde y lo cierra.
      this.state.registrarResultadoEnvio(ultimo.reintentable);

      // TA-32 criterio 3: si el intento anterior quedó en estado incierto
      // (timeout), se reconcilia con SUNAT ANTES de volver a enviar. Si SUNAT
      // ya tenía el comprobante, su CDR se recupera y no se reenvía nada.
      if (incierto) {
        const consulta = await this.consultarAntesDeReenviar(job, intento);
        if (consulta.tipo === 'INCIERTO') return this.pendientePorIncertidumbre(job, estadoAnterior, intento, ultimo, consulta.motivo);
        if (consulta.tipo === 'RECUPERADO') return this.resultado(job.invoiceId, consulta.resultado, intento, false, false);
      }

      incierto = false; // La consulta anterior confirmó ausencia o recuperó el CDR.
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

  private async incertidumbre(invoiceId: string, value: boolean): Promise<void> {
    if (this.prisma) await this.prisma.invoice.update({ where: { id: invoiceId }, data: { transport_uncertain: value } });
  }

  private async consultarAntesDeReenviar(job: RetryInvoiceJob, intento: number): Promise<DesenlaceConciliacion> {
    let consulta: DesenlaceConciliacion;
    try {
      consulta = this.consultaEstado ? await this.consultaEstado.consultarEstado({
        invoiceId: job.invoiceId, rucEmisor: job.rucEmisor, tipoComprobante: job.tipoComprobante,
        serie: job.serie, correlativo: job.correlativo, estadoActual: job.estadoActual ?? null, intento,
      }) : { tipo: 'INCIERTO', motivo: 'Servicio de consulta no disponible.' };
    } catch {
      // Defensa ante implementaciones del puerto que fallen: nunca equivale a ausencia.
      consulta = { tipo: 'INCIERTO', motivo: 'No se pudo completar la consulta de estado.' };
    }
    if (consulta?.tipo === 'RECUPERADO' && (!consulta.resultado.cdr || !['ACEPTADO', 'OBSERVADO', 'RECHAZADO'].includes(consulta.resultado.estado))) {
      consulta = { tipo: 'INCIERTO', motivo: 'La consulta respondió sin CDR concluyente.' };
    }
    if (!consulta || !['RECUPERADO', 'NO_ENCONTRADO', 'INCIERTO'].includes(consulta.tipo)) {
      consulta = { tipo: 'INCIERTO', motivo: 'Respuesta de consulta no concluyente.' };
    }
    if (consulta.tipo !== 'INCIERTO') await this.incertidumbre(job.invoiceId, false);
    return consulta;
  }

  private async pendientePorIncertidumbre(job: RetryInvoiceJob, estado: InvoiceStatus | null,
    intentos: number, ultimo: ProcessCdrResult | null, motivo: string): Promise<RetryInvoiceResult> {
    const error = `Incertidumbre de transporte: ${motivo}`;
    await this.incertidumbre(job.invoiceId, true);
    if (this.prisma) {
      const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: job.invoiceId }, select: { estado: true, company_id: true } });
      estado = invoice.estado;
      await this.prisma.transactionHistory.create({ data: {
        company_id: invoice.company_id, invoice_id: job.invoiceId,
        intento: intentos, estado_anterior: invoice.estado, estado_nuevo: invoice.estado,
        codigo_error: CONSULTA_INCIERTA, mensaje_error: error, tiempo_respuesta_ms: null, http_status_code: null,
      } });
    }
    this.logger.warn(`[M1] ${job.invoiceId}: ${error}; pendiente de conciliación, sin DLQ.`);
    return { invoiceId: job.invoiceId, estado: estado ?? InvoiceStatus.ENVIADO, intentos,
      reintentable: true, enviadoADlq: false, circuitoAbierto: false, incertidumbreTransporte: true,
      ultimoResultado: ultimo, error };
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
