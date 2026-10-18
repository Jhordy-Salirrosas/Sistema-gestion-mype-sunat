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
}
