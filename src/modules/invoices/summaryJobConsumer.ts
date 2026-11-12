/** Consumidor M1: una consulta por corrida y sondeos diferidos durables. */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService, type SummaryJobData } from '../resilience/infrastructure/queue/queue.service';
import { SummaryDispatchService, type ResultadoEnvioResumen } from './application/services/summaryDispatchService';
import { SummaryAggregateStore } from './application/services/summaryAggregateStore';

export interface SummaryPollingJob extends SummaryJobData {
  /** Se conserva en el payload de pg-boss entre procesos/reinicios. */
  sondeoIntento?: number;
  ticketConsulta?: string;
}
import { MAX_SUMMARY_POLL_ATTEMPTS, summaryPollDelay } from './application/services/summaryPollingCoordinator';
export { MAX_SUMMARY_POLL_ATTEMPTS, summaryPollDelay } from './application/services/summaryPollingCoordinator';

@Injectable()
export class SummaryJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(SummaryJobConsumer.name);
  constructor(private readonly queue: QueueService, private readonly despachador: SummaryDispatchService,
    private readonly store: SummaryAggregateStore) {}

  async onModuleInit(): Promise<void> {
    if (typeof this.queue.registerSummaryWorker !== 'function') {
      this.logger.warn('QueueService sin registerSummaryWorker: el consumidor de resumenes no se registra');
      return;
    }
    await this.queue.registerSummaryWorker(job => this.procesar(job));
    this.logger.log('Consumidor de resumenes registrado');
  }

  async procesar(job: SummaryPollingJob): Promise<ResultadoEnvioResumen | null> {
    if (!job?.identificador) {
      this.logger.error('Job de resumen sin identificador: se descarta');
      return null;
    }
    const attempt = job.sondeoIntento ?? 1;
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_SUMMARY_POLL_ATTEMPTS) throw new Error('SUMMARY_POLL_ATTEMPT_INVALID');
    if (attempt > 1 && !job.ticketConsulta) throw new Error('SUMMARY_POLL_TICKET_REQUIRED');
    const resultado = await this.despachador.procesar(job, { maxConsultas: 0, ticketEsperado: job.ticketConsulta, automatico: true, sondeoIntento: attempt });
    if (resultado.status?.startsWith('SUMMARY_POLL_')) return resultado;
    if (resultado.enviado) {
      this.logger.log(`[TA-67] ${job.identificador}: CDR obtenido con estado ${resultado.status ?? 'desconocido'}`);
      return resultado;
    }
    const reintentable = resultado.status === null || ['98', '99'].includes(resultado.status);
    if (resultado.ticket && reintentable) {
      if (attempt === MAX_SUMMARY_POLL_ATTEMPTS) {
        const error = `Sondeo automático agotado tras ${attempt} intentos. El agregado permanece en POLLING; consulte el ticket manualmente. Último motivo: ${resultado.error ?? resultado.status}`;
        const row = await this.store.cargar(job.companyId, job.identificador);
        await this.store.pendiente(row.id, error, resultado.ticket);
        this.logger.warn(`[${job.identificador}] ${error}`);
        return { ...resultado, error };
      }
      const next: SummaryPollingJob = { ...job, sondeoIntento: attempt + 1, ticketConsulta: resultado.ticket, maxConsultas: 0 };
      const startAfter = new Date(Date.now() + summaryPollDelay(attempt));
      const id = await this.despachador.programarSondeo(next, startAfter);
      if (!id) throw new Error('SUMMARY_POLL_ENQUEUE_FAILED: ticket conservado; publicación pendiente');
      this.logger.log(`[${job.identificador}] sondeo ${attempt + 1}/${MAX_SUMMARY_POLL_ATTEMPTS} programado para ${startAfter.toISOString()}`);
      return resultado;
    }
    // Sin ticket no existe una consulta segura: conserva la política previa
    // de infraestructura/DLQ, sin liberar la incertidumbre ni reenviar a ciegas.
    if (resultado.ticket === null || reintentable) throw new Error(`${job.identificador}: ${resultado.error ?? 'envío incompleto, se reintenta'}`);
    this.logger.error(`[TA-67] ${job.identificador}: ${resultado.error ?? resultado.status}`);
    return resultado;
  }
}
