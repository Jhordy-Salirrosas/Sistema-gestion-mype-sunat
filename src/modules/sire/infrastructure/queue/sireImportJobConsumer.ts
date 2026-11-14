import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  QueueService,
  type SireImportJobData,
} from '../../../resilience/infrastructure/queue/queue.service';
import { generarTicketSimulado } from '../../application/use-cases/reportarSireUseCase';
import { describeErrorSafely } from '../../domain/rules/sireRedactionUtils';
import { SireMenuRepository } from '../persistence/sireMenuRepository';

/**
 * Tiempo que el worker simula que tarda en procesar el trabajo.
 *
 * Son dos segundos a propósito: son suficientes para que el frontend vea el
 * estado PENDING y luego COMPLETED al hacer el sondeo, y son lo bastante
 * cortos para que la espera no se note como un fallo.
 */
export const SIRE_SIMULACION_DELAY_MS = 2_000;

/** Error que se registra cuando el trabajo se agota en la cola de muertos. */
const SIRE_RETRIES_EXHAUSTED = 'SIRE_RETRIES_EXHAUSTED';

/**
 * Consumidor de los trabajos del menú SIRE.
 *
 * El trabajo ya se validó y se guardó antes de llegar aquí: el worker solo
 * SIMULA el procesamiento (espera, marca COMPLETED y deja el resultado) y
 * actualiza el estado del registro para que el frontend pueda seguirlo.
 */
@Injectable()
export class SireImportJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(SireImportJobConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly repository: SireMenuRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    /**
     * Un doble de QueueService en las pruebas puede no exponer los metodos de
     * registro de worker: en ese caso no hay cola que consumir y el arranque
     * de la aplicación no debe fallar por ello.
     */
    if (typeof this.queue.registerSireImportWorker !== 'function') {
      this.logger.warn(
        'QueueService sin registerSireImportWorker: el consumidor del menú SIRE no se registra',
      );
      return;
    }

    this.logger.log('Iniciando worker del menú SIRE');
    await this.queue.registerSireImportWorker((job) => this.process(job));

    if (typeof this.queue.registerSireImportDlqWorker === 'function') {
      await this.queue.registerSireImportDlqWorker((job) =>
        this.markRetriesExhausted(job),
      );
    }

    this.logger.log('Worker del menú SIRE inicializado');
  }

  async process(job: SireImportJobData): Promise<void> {
    try {
      await this.runJob(job);
    } catch (error) {
      /**
       * El error se relanza: PgBoss lo captura y reprograma el trabajo con
       * backoff. Agotados los reintentos, el trabajo llega a la DLQ y ahí se
       * marca como FAILED.
       */
      this.logger.error(
        `No se pudo completar el trabajo SIRE ${job.messageId}: ${describeErrorSafely(error)}`,
      );
      throw error;
    }
  }

  /**
   * Cuerpo del trabajo.
   */
  private async runJob(job: SireImportJobData): Promise<void> {
    if (job.tipo === 'IMPORTACION') {
      await this.repository.marcarImportacionEnProceso(job.registroId);
    } else {
      await this.repository.marcarReporteEnProceso(job.registroId);
    }

    // Simulación del procesamiento: el tiempo que tardaría el envío real.
    await this.esperar(this.delaySimulacion());

    if (job.tipo === 'IMPORTACION') {
      const totalRegistros = this.totalRegistrosSimulados(job);
      await this.repository.completarImportacion(job.registroId, totalRegistros);
      this.logger.log(
        `Importación SIRE completada (messageId=${job.messageId}, registros=${totalRegistros})`,
      );
      return;
    }

    const ticket = await this.ticketDelReporte(job);
    await this.repository.completarReporte(job.registroId, ticket);
    this.logger.log(
      `Reporte SIRE completado (messageId=${job.messageId}, ticket=${ticket})`,
    );
  }

  /**
   * Marca el trabajo como fallido cuando llega a la cola de muertos.
   */
  private async markRetriesExhausted(job: SireImportJobData): Promise<void> {
    try {
      if (job.tipo === 'IMPORTACION') {
        await this.repository.fallarImportacion(
          job.registroId,
          SIRE_RETRIES_EXHAUSTED,
        );
      } else {
        await this.repository.fallarReporte(
          job.registroId,
          SIRE_RETRIES_EXHAUSTED,
        );
      }
    } catch (error) {
      this.logger.error(
        `No se pudo marcar el trabajo SIRE ${job.messageId} como fallido: ${describeErrorSafely(error)}`,
      );
    }
  }

  /**
   * Número de registros simulados de una importación.
   *
   * Se deriva del identificador del trabajo para que el mismo archivo produzca
   * siempre el mismo resultado.
   */
  private totalRegistrosSimulados(job: SireImportJobData): number {
    const semilla = job.messageId.split('').reduce(
      (acumulado, caracter) => (acumulado * 31 + caracter.charCodeAt(0)) % 997,
      7,
    );
    return 1 + (semilla % 250);
  }

  /**
   * Ticket del reporte.
   *
   * El ticket ya se generó y se guardó al registrar el trabajo: el worker solo
   * lo confirma. Si por algún motivo no está, se genera uno nuevo.
   */
  private async ticketDelReporte(job: SireImportJobData): Promise<string> {
    const registro = await this.repository.buscarReportePorMessageId(
      job.companyId,
      job.messageId,
    );
    return registro?.ticket ?? generarTicketSimulado();
  }

  private delaySimulacion(): number {
    const configurado = Number(process.env['SIRE_SIMULACION_DELAY_MS']);
    return Number.isFinite(configurado) && configurado >= 0
      ? configurado
      : SIRE_SIMULACION_DELAY_MS;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
