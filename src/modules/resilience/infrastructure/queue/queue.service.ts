<<<<<<< HEAD
import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
=======
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
>>>>>>> f65e879ff3e92a4af1e23116ae67252e569d6273
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
<<<<<<< HEAD
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
=======
    try {
      const db = fromPrisma(tx);
      return await this.boss.send(INVOICE_QUEUE, { invoice_id: invoiceId }, { db });
    } catch (error) {
      this.logger.error(`Error al encolar comprobante ${invoiceId}:`, error);
      return null;
    }
>>>>>>> f65e879ff3e92a4af1e23116ae67252e569d6273
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
<<<<<<< HEAD
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
=======
    try {
      return await this.boss.send(
        INVOICE_DLQ,
        { invoice_id: invoiceId, ...detalle },
        { retryLimit: 0 },
      );
    } catch {
      return null;
    }
  }

  /** Devuelve un trabajo de la DLQ a la cola principal para reintentarlo. */
  async retryDlq(id: string): Promise<void> {
    try {
      await this.boss.retry(INVOICE_DLQ, id);
    } catch (error) {
      this.logger.error(`Error al reintentar trabajo de DLQ ${id}:`, error);
    }
>>>>>>> f65e879ff3e92a4af1e23116ae67252e569d6273
  }
}