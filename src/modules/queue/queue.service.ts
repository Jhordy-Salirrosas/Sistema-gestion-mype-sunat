import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PgBoss, fromPrisma } from 'pg-boss';

export const INVOICE_QUEUE = 'sunat-invoice-queue';

export interface TxClient {
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: unknown[]
  ): Promise<T>;
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

    return this.boss.send(
      INVOICE_QUEUE,
      { invoice_id: invoiceId },
      { db },
    );
  }
}