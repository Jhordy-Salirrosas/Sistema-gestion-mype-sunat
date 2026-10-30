import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PgBoss, fromPrisma } from 'pg-boss';

export const INVOICE_QUEUE = 'sunat-invoice-queue';
export const INVOICE_DLQ = 'sunat-invoice-dlq';

export interface TxClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/** Payload del job que viaja en la cola: solo identifica el comprobante. */
export interface InvoiceJobData {
  invoice_id: string;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly boss: PgBoss;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('La variable DATABASE_URL no está configurada');
    }

    this.boss = new PgBoss(databaseUrl);
  }

  async onModuleInit(): Promise<void> {
    await this.boss.start();

    await this.boss.createQueue(INVOICE_DLQ);
    await this.boss.createQueue(INVOICE_QUEUE, {
      retryLimit: 3,
      retryDelay: 5,
      retryBackoff: true,
      deadLetter: INVOICE_DLQ,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop();
  }

  /**
   * Encola el procesamiento del comprobante utilizando
   * la misma transacción de Prisma.
   */
  async enqueueInvoiceInTx(
    tx: TxClient,
    invoiceId: string,
  ): Promise<string | null> {
    const db = fromPrisma(tx);

    return this.boss.send(INVOICE_QUEUE, { invoice_id: invoiceId }, { db });
  }

  /**
   * Cuantos trabajos esperan en la cola principal.
   * Lo usa `GET /api/v1/resilience/metrics` como `bufferedInvoicesCount`.
   */
  async countQueued(): Promise<number> {
    try {
      const jobs = await this.boss.findJobs(INVOICE_QUEUE);
      return jobs.length;
    } catch {
      // Si pg-boss no responde, el dashboard no debe romperse: informa 0.
      return 0;
    }
  }

  /**
   * Trabajos que agotaron los reintentos y cayeron a la cola de muertos.
   *
   * El job de pg-boss solo guarda `invoice_id` en su payload, asi que los datos
   * completos del comprobante (serie, RUC del cliente, monto y codigo SUNAT) se
   * completan cuando se conecte el repositorio de facturas.
   */
  async listDlq(): Promise<Array<Record<string, unknown>>> {
    try {
      const jobs = await this.boss.findJobs<{ invoice_id?: string }>(
        INVOICE_DLQ,
      );

      return jobs.map((job) => ({
        id: job.id,
        comprobanteSerieNumero: job.data?.invoice_id ?? 'sin identificar',
        clienteRuc: '',
        monto: 0,
        codigoErrorSunat: '',
        mensajeError: 'El comprobante agoto los reintentos automaticos',
        intentosFallidos: job.retryCount ?? 0,
        fechaUltimoIntento: new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /** Devuelve un trabajo de la DLQ a la cola principal para reintentarlo. */
  async retryDlq(id: string): Promise<void> {
    await this.boss.retry(INVOICE_DLQ, id);
  }

  /**
   * TA-28 (criterio 1): registra el consumidor de la cola de facturas.
   *
   * Con `teamSize: 1` y `batchSize: 1` se procesa un comprobante por vez: el
   * pipeline fiscal no debe paralelizarse porque comparte el correlativo y el
   * estado del Circuit Breaker.
   *
   * pg-boss entrega el job con `data = { invoice_id }`; el handler recibe
   * directamente ese payload.
   */
  async registerInvoiceWorker(
    handler: (job: InvoiceJobData) => Promise<unknown>,
  ): Promise<string> {
    this.logger.log(
      `Registrando worker de comprobantes en la cola ${INVOICE_QUEUE}`,
    );

    return this.boss.work<InvoiceJobData>(
      INVOICE_QUEUE,
      { batchSize: 1 },
      async (jobs) => {
        const job = jobs[0];
        if (!job) return;

        this.logger.log(`[Job recibido] Comprobante: ${job.data.invoice_id}`);
        await handler(job.data);
      },
    );
  }

  /**
   * TA-28 (criterio 4): mueve un job agotado a la DLQ.
   *
   * pg-boss ya declara `deadLetter: INVOICE_DLQ`, pero el worker necesita un
   * envio explicito cuando su propio bucle de reintentos se rinde, para que el
   * comprobante quede visible en el monitor de DLQ.
   */
  async moveToDlq(jobData: InvoiceJobData, motivo: string): Promise<void> {
    try {
      await this.boss.send(INVOICE_DLQ, {
        ...jobData,
        motivo,
        enviado_a_dlq_en: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo mover el comprobante ${jobData.invoice_id} a la DLQ: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
