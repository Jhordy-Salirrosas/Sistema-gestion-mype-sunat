import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { Prisma } from '../../../../generated/client/client';
import { RegisterManualMovementUseCase } from '../../../inventory/application/use-cases/registerManualMovementUseCase';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';
import { PrismaAccountingRepository } from '../../../accounting/infrastructure/prismaAccountingRepository';
import { MODULO_ORIGEN, claveAsientoM1 } from './invoiceAccountingBridgeService';

export interface RaReversalWork { action: 'REVERSE_RA_BRIDGE'; invoiceId: string; status: 'PENDING' | 'DONE'; attempts: number; nextAt: string; cause?: string; }
export const raReversalWork = (ids: string[]): RaReversalWork[] => ids.map(invoiceId => ({ action: 'REVERSE_RA_BRIDGE', invoiceId, status: 'PENDING', attempts: 0, nextAt: new Date().toISOString() }));
export function raWorks(result: unknown): RaReversalWork[] {
  const value = result as { bridgeReversals?: RaReversalWork[] } | null;
  return Array.isArray(value?.bridgeReversals) ? value.bridgeReversals : [];
}
/** Trabajos locales durables en el JSON del agregado; nunca abre transporte SUNAT. */
@Injectable()
export class RaBridgeReversalService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly manual: RegisterManualMovementUseCase) {}
  onModuleInit() { this.timer = setInterval(() => void this.recuperar().catch(() => undefined), 60_000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async recuperar() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.prisma.invoiceAggregate.findMany({ where: { kind: 'RA', state: 'ACCEPTED', result: { path: ['bridgeReversals'], array_contains: [{ status: 'PENDING' }] } }, orderBy: { updated_at: 'asc' }, take: 50 });
      for (const row of rows) for (const work of raWorks(row.result)) {
        if (work.status !== 'DONE' && Date.parse(work.nextAt) <= Date.now()) await this.procesar(row.id, work.invoiceId);
      }
    } finally { this.running = false; }
  }
  async procesar(aggregateId: string, invoiceId: string): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async tx => {
        // Mismo lock que el puente: una descarga ya iniciada concluye antes de su reversión.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`m1:bridge:${invoiceId}`}, 0))`;
        await tx.$executeRaw`SELECT id FROM invoice_aggregates WHERE id = ${aggregateId} FOR UPDATE`;
        const row = await tx.invoiceAggregate.findUniqueOrThrow({ where: { id: aggregateId } });
        if (row.kind !== 'RA' || row.state !== 'ACCEPTED') throw new Error('RA_REVERSAL_NOT_ACCEPTED');
        const works = raWorks(row.result);
        const work = works.find(w => w.invoiceId === invoiceId && w.action === 'REVERSE_RA_BRIDGE');
        if (!work || work.status === 'DONE') return true;
        const invoice = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, company_id: row.company_id, estado: 'ANULADO' } });
        const reference = `${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}`;
        const movements = await tx.inventoryMovement.findMany({ where: { company_id: row.company_id, source_reference_id: reference, operation_type_code: { in: ['01', '05'] } }, include: { warehouse: true, product: true }, orderBy: { id: 'asc' } });
        const manual = this.manual.enTransaccion(tx);
        for (const movement of movements) {
          const key = `ra:${aggregateId}:${movement.id}`;
          const existing = await tx.inventoryMovement.findFirst({ where: { company_id: row.company_id, source_reference_id: key } });
          if (existing) continue;
          if (!movement.quantity.isPositive() || !movement.total_cost.isFinite()) throw new Error('RA_REVERSAL_COST_UNAVAILABLE');
          const reversed = await manual.execute({ warehouse_code: movement.warehouse.warehouse_code, sku: movement.product.sku,
            direction: movement.direction === 'SALIDA' ? 'ENTRADA' : 'SALIDA', quantity: Number(movement.quantity),
            unit_cost: Number(movement.total_cost.div(movement.quantity)), operation_type_code: movement.direction === 'SALIDA' ? '05' : '01',
            source_reference_id: key, document_type_code: invoice.tipo_comprobante, document_serial: invoice.serie,
            document_number: String(invoice.correlativo), movement_date: row.generation_date,
            notes: `Contramovimiento RA ${row.identifier}; origen ${movement.id}` }, row.company_id);
          if (!new Prisma.Decimal(reversed.totalCost).toDecimalPlaces(2).equals(movement.total_cost.toDecimalPlaces(2))) throw new Error('RA_REVERSAL_COST_MISMATCH');
        }
        // Revertir las líneas realmente asentadas, no las reglas o precios actuales.
        const entries = await tx.accountingEntry.findMany({ where: { company_id: row.company_id, status: 'ASENTADO', OR: [
          { idempotency_key: claveAsientoM1(invoiceId) },
          { source_module: { in: [MODULO_ORIGEN, 'INVOICES'] }, source_reference_id: { in: [reference, invoiceId, `${invoiceId}:COSTO`, `${invoiceId}:COSTO-REV`] } },
          { idempotency_key: { in: [`m1:invoice-cost:${invoiceId}`, `m1:invoice-cost-rev:${invoiceId}`] } },
        ] }, include: { lines: true }, orderBy: { id: 'asc' } });
        const generate = new GenerateAccountingEntryUseCase(new PrismaAccountingRepository(tx as unknown as PrismaService));
        for (const entry of entries) {
          await generate.execute({ companyId: row.company_id, period: row.generation_date.slice(0, 7), entryDate: `${row.generation_date}T00:00:00Z`,
            journalCode: entry.journal_code, glosa: `Reversión RA ${row.identifier}; asiento ${entry.id}`,
            sourceModule: MODULO_ORIGEN, sourceReferenceId: `ra:${aggregateId}:${entry.id}`, idempotencyKey: `m1:ra:${aggregateId}:${entry.id}`,
            lines: entry.lines.map(l => ({ lineOrder: l.line_order, accountCode: l.account_code, accountName: l.account_name, debitAmount: Number(l.credit_amount), creditAmount: Number(l.debit_amount) })) });
        }
        work.status = 'DONE'; work.attempts++; delete work.cause;
        await tx.invoiceAggregate.update({ where: { id: row.id }, data: { result: { ...(row.result as object), bridgeReversals: works } as unknown as Prisma.InputJsonValue } });
        await tx.transactionHistory.create({ data: { invoice_id: invoiceId, company_id: row.company_id, estado_anterior: 'ANULADO', estado_nuevo: 'ANULADO', codigo_error: 'M1_RA_REVERSAL_DONE', mensaje_error: `Reversión local completada para ${row.identifier}.` } });
        return true;
      }, { timeout: 30000 });
    } catch (error) {
      await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT id FROM invoice_aggregates WHERE id = ${aggregateId} FOR UPDATE`;
        const row = await tx.invoiceAggregate.findUniqueOrThrow({ where: { id: aggregateId } });
        const works = raWorks(row.result), work = works.find(w => w.invoiceId === invoiceId);
        if (!work || work.status === 'DONE') return;
        work.attempts++; work.nextAt = new Date(Date.now() + Math.min(3600, 60 * 2 ** Math.min(work.attempts - 1, 6)) * 1000).toISOString();
        work.cause = error instanceof Error && /^RA_REVERSAL_[A-Z_]+$/.test(error.message) ? error.message : 'RA_REVERSAL_LOCAL_FAILURE';
        await tx.invoiceAggregate.update({ where: { id: row.id }, data: { result: { ...(row.result as object), bridgeReversals: works } as unknown as Prisma.InputJsonValue } });
        const actual = await tx.invoice.findFirst({ where: { id: invoiceId, company_id: row.company_id }, select: { estado: true } });
        if (actual) await tx.transactionHistory.create({ data: { invoice_id: invoiceId, company_id: row.company_id, estado_anterior: actual.estado, estado_nuevo: actual.estado, codigo_error: 'M1_RA_REVERSAL_PENDING', mensaje_error: `ANULADO con reversión pendiente: ${work.cause}.` } });
      });
      return false;
    }
  }
}
