/**
 * Consumidor de la cola de resúmenes y bajas (TA-67).
 *
 * Registra el `boss.work` de `sunat-summary-queue` y delega el envío en
 * `SummaryDispatchService`, que es quien conoce la secuencia
 * `sendSummary` -> `getStatus(ticket)` y la distinción entre "en proceso"
 * (98/99) y un resultado final.
 *
 * IGUAL QUE EL CONSUMIDOR DE FACTURAS, NO LANZA HACIA PG-BOSS
 *
 * Un `throw` aquí haría que el transporte marcara el job como fallido y lo
 * reintentara con su propia política, saltándose la que ya decidió
 * `SummaryDispatchService`. La única excepción es cuando el envío se quedó sin
 * completar por un motivo REINTENTABLE (timeout, red caída, SUNAT procesando):
 * en ese caso sí se relanza, porque devolver `null` dejaría el resumen
 * perdido y sin volver a intentarse, y el día quedaría sin informar.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// Valor, no `import type`: Nest necesita el metatipo del constructor.
import {
  QueueService,
  type SummaryJobData,
} from '../resilience/infrastructure/queue/queue.service';
import {
  SummaryDispatchService,
  type ResultadoEnvioResumen,
} from './application/services/summaryDispatchService';

@Injectable()
export class SummaryJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(SummaryJobConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly despachador: SummaryDispatchService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Las pruebas e2e usan un doble de QueueService que puede no exponer el
    // método: en ese caso no hay cola de resúmenes que consumir.
    if (typeof this.queue.registerSummaryWorker !== 'function') {
      this.logger.warn(
        'QueueService sin registerSummaryWorker: el consumidor de resumenes no se registra',
      );
      return;
    }

    await this.queue.registerSummaryWorker((job) => this.procesar(job));
    this.logger.log('Consumidor de resumenes registrado');
  }

  /**
   * Procesa un job de la cola.
   *
   * @throws cuando el fallo es reintentable, para que pg-boss aplique sus 3
   *   reintentos y, agotados, lo deje en `sunat-summary-dlq`.
   */
  async procesar(job: SummaryJobData): Promise<ResultadoEnvioResumen | null> {
    if (!job?.identificador) {
      this.logger.error('Job de resumen sin identificador: se descarta');
      return null;
    }

    const resultado = await this.despachador.procesar(job);

    if (resultado.enviado) {
      this.logger.log(
        `[TA-67] ${job.identificador}: CDR obtenido con estado ${resultado.status ?? 'desconocido'}`,
      );
      return resultado;
    }

    // "SUNAT sigue procesando" y los fallos de red se reintentan: el resumen
    // todavía puede informarse. Un rechazo definitivo, no.
    const reintentable =
      resultado.ticket === null ||
      resultado.status === null ||
      ['98', '99'].includes(resultado.status);

    if (reintentable) {
      throw new Error(
        `${job.identificador}: ${resultado.error ?? 'envio incompleto, se reintenta'}`,
      );
    }

    this.logger.error(
      `[TA-67] ${job.identificador}: SUNAT respondio ${resultado.status} sin CDR; no se reintenta`,
    );
    return resultado;
  }
}
