import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PgBoss, fromPrisma } from 'pg-boss';

export const INVOICE_QUEUE = 'sunat-invoice-queue';
export const INVOICE_DLQ = 'sunat-invoice-dlq';

export interface TxClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
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
    // Los reintentos con backoff (5, 15 y 45 s) los decide `InvoiceRetryService`
    // aplicando `backoffPolicy.ts`. pg-boss solo transporta y persiste: si se
    // dejara su propio retryLimit, cada job se reintentaría dos veces (una por
    // pg-boss y otra por el orquestador) y la secuencia dejaría de cumplirse.
    await this.boss.createQueue(INVOICE_QUEUE, {
      retryLimit: 0,
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
      const jobs = await this.boss.findJobs<{
        invoice_id?: string;
        intento?: number;
        codigo_error?: string;
        mensaje_error?: string;
        estado?: string;
      }>(INVOICE_DLQ);

      return jobs.map((job) => ({
        id: job.id,
        comprobanteSerieNumero: job.data?.invoice_id ?? 'sin identificar',
        clienteRuc: '',
        monto: 0,
        codigoErrorSunat: job.data?.codigo_error ?? '',
        mensajeError:
          job.data?.mensaje_error ??
          'El comprobante agoto los reintentos automaticos',
        intentosFallidos: job.data?.intento ?? job.retryCount ?? 0,
        estado: job.data?.estado ?? 'ERROR_RED',
        fechaUltimoIntento: new Date().toISOString(),
      }));
    } catch {
      return [];
    }
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
    detalle: Record<string, unknown> = {},
  ): Promise<string | null> {
    return this.boss.send(
      INVOICE_DLQ,
      { invoice_id: invoiceId, ...detalle },
      { retryLimit: 0 },
    );
  }

  /** Devuelve un trabajo de la DLQ a la cola principal para reintentarlo. */
  async retryDlq(id: string): Promise<void> {
    await this.boss.retry(INVOICE_DLQ, id);
  }
}
