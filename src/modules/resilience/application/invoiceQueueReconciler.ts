import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InvoiceStatus } from '../../../generated/client/enums';
import { PrismaService } from '../../../database/prismaService';
import { QueueService } from '../infrastructure/queue/queue.service';
import { ResilienceStateService } from './resilienceStateService';

/**
 * Reconciliador D12: devuelve a la cola comprobantes EN_COLA sin job vivo.
 *
 * El worker no puede reprogramar un job que ya está `active` con pg-boss.
 * Por eso el comprobante se deja en EN_COLA y este proceso lo reencola
 * cuando el circuito vuelve a permitir envíos.
 */
@Injectable()
export class InvoiceQueueReconciler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvoiceQueueReconciler.name);
  private timer?: NodeJS.Timeout;
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly circuit: ResilienceStateService,
  ) {}

  onModuleInit(): void {
    const intervalo = Number(process.env.M2_REQUEUE_INTERVAL_MS ?? 60_000);
    if (!Number.isFinite(intervalo) || intervalo <= 0) return;
    this.timer = setInterval(() => void this.reconciliar(), intervalo);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Ejecuta una pasada; es público para poder probarlo sin esperar el timer. */
  async reconciliar(): Promise<{ revisados: number; encolados: number }> {
    if (this.ejecutando) return { revisados: 0, encolados: 0 };
    if (!this.circuit.puedeEnviar()) {
      this.logger.warn('Reconciliador: circuito abierto, no se reencola');
      return { revisados: 0, encolados: 0 };
    }

    this.ejecutando = true;
    let encolados = 0;
    try {
      const pendientes = await this.prisma.invoice.findMany({
        where: { estado: InvoiceStatus.EN_COLA },
        select: { id: true, company_id: true },
        take: 100,
        orderBy: { created_at: 'asc' },
      });

      for (const factura of pendientes) {
        const resultado = await this.queue.reenqueueInvoiceIfIdle(
          factura.id,
          factura.company_id,
          async () => {
            const actual = await this.prisma.invoice.findUnique({
              where: { id: factura.id },
              select: { estado: true },
            });
            return actual?.estado === InvoiceStatus.EN_COLA;
          },
        );
        if (resultado.estado === 'ENCOLADO') encolados += 1;
      }

      if (encolados > 0) {
        this.logger.log(`Reconciliador: ${encolados} comprobante(s) reencolado(s)`);
      }
      return { revisados: pendientes.length, encolados };
    } finally {
      this.ejecutando = false;
    }
  }
}
