import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PgBoss, fromPrisma } from 'pg-boss';

export const INVOICE_QUEUE = 'sunat-invoice-queue';
export const INVOICE_DLQ = 'sunat-invoice-dlq';

export interface TxClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  invoice?: {
    findUnique: (args: {
      where: { id: string };
      select: { company_id: true };
    }) => Promise<{ company_id: string } | null>;
  };
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
    const databaseUrl = process.env.PG_BOSS_URL || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('La variable DATABASE_URL o PG_BOSS_URL no está configurada');
    }

    this.boss = new PgBoss(databaseUrl);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.boss.start();

      await this.boss.createQueue(INVOICE_DLQ);
      // Los reintentos con backoff (5, 15 y 45 s) los decide `InvoiceRetryService`
      // aplicando `backoffPolicy.ts`. pg-boss solo transporta y persiste: si se
      // dejara su propio retryLimit, cada job se reintentaría dos veces (una por
      // pg-boss y otra por el orquestador) y la secuencia dejaría de cumplirse.
      await this.boss.createQueue(INVOICE_QUEUE, {
        retryLimit: 0,
        deadLetter: INVOICE_DLQ,
      });

      this.logger.log('Servicio de colas PgBoss iniciado correctamente');
    } catch (error) {
      this.logger.warn(
        `No se pudo conectar con PgBoss (${(error as Error).message}). El backend iniciará en modo bypass para desarrollo.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.boss.stop();
    } catch {
      // Ignorar errores al apagar el servicio si no estaba activo
    }
  }

  /**
   * Encola el procesamiento del comprobante utilizando
   * la misma transacción de Prisma.
   */
  async enqueueInvoiceInTx(
    tx: TxClient,
    invoiceId: string,
  ): Promise<string | null> {
    if (!tx.invoice?.findUnique) {
      throw new Error('El cliente transaccional no permite obtener la empresa.');
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { company_id: true },
    });
    if (!invoice) {
      throw new Error(`No existe el comprobante ${invoiceId} para encolarlo.`);
    }

    const db = fromPrisma(tx);

    return this.boss.send(
      INVOICE_QUEUE,
      { invoice_id: invoiceId, company_id: invoice.company_id },
      { db },
    );
  }

  /**
   * Cuantos trabajos esperan en la cola principal.
   * Mantiene el conteo operativo de la cola para las tareas internas.
   */
  async countQueued(): Promise<number> {
    const jobs = await this.boss.findJobs(INVOICE_QUEUE);
    return jobs.length;
  }

  /**
   * Trabajos que agotaron los reintentos y cayeron a la cola de muertos.
   *
   * Los jobs nuevos incluyen el company_id para filtrar resultados en la capa
   * de pg-boss, antes de devolverlos al controlador.
   */
  async listDlq(companyId: string): Promise<Array<Record<string, unknown>>> {
    const jobs = await this.boss.findJobs<{
      invoice_id?: string;
      company_id?: string;
      intento?: number;
      codigo_error?: string;
      mensaje_error?: string;
      estado?: string;
    }>(INVOICE_DLQ, { data: { company_id: companyId }, queued: true });

    return jobs
      .filter((job) => job.data?.company_id === companyId)
      .map((job) => ({
        id: job.id,
        comprobanteSerieNumero: job.data?.invoice_id ?? 'sin identificar',
        clienteRuc: '',
        monto: 0,
        codigoErrorSunat: job.data?.codigo_error ?? '',
        mensajeError:
          job.data?.mensaje_error ??
          'El comprobante agotó los reintentos automáticos',
        intentosFallidos: job.data?.intento ?? job.retryCount ?? 0,
        estado: job.data?.estado ?? 'ERROR_RED',
        fechaUltimoIntento: new Date().toISOString(),
      }));
  }

  /**
   * Mueve explícitamente un comprobante a la DLQ.
   *
   * Lo usa `InvoiceRetryService` al agotar los 3 reintentos de HU-04. Se crea
   * un job nuevo en la cola de muertos (con `retryLimit: 0` para que no vuelva
   * a ejecutarse solo) y se conserva el motivo y el número de intento para que
   * el panel de la DLQ pueda mostrarlos.
   */
  async sendToDlq(
    invoiceId: string,
    companyId: string,
    detalle: Record<string, unknown> = {},
  ): Promise<string | null> {
    return this.boss.send(
      INVOICE_DLQ,
      { invoice_id: invoiceId, company_id: companyId, ...detalle },
      { retryLimit: 0 },
    );
  }

  /** Devuelve un trabajo propio de la empresa autenticada a la cola principal. */
  async retryDlq(id: string, companyId: string): Promise<void> {
    const [job] = await this.boss.findJobs<{ company_id?: string }>(
      INVOICE_DLQ,
      { id, queued: true },
    );
    if (!job || job.data?.company_id !== companyId) {
      throw new NotFoundException('No se encontró el trabajo de DLQ.');
    }

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
