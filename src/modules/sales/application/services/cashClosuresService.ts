import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fecha = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD.');
  return new Date(`${date}T00:00:00.000Z`);
};
const rango = (date: string) => {
  const inicio = new Date(`${date}T00:00:00.000-05:00`);
  return { inicio, fin: new Date(inicio.getTime() + 86400000) };
};
const map = (c: any) => ({
  id: c.id, date: c.closure_date, salesTotal: Number(c.sales_total), collectionsTotal: Number(c.collections_total),
  cashCollections: Number(c.cash_collections), cashExpenses: Number(c.cash_expenses), expectedCash: Number(c.expected_cash),
  countedCash: Number(c.counted_cash), difference: Number(c.difference), details: c.details, notes: c.notes,
  status: c.status, createdAt: c.created_at,
});

@Injectable()
export class CashClosuresService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string, date: string) {
    fecha(date);
    const { inicio, fin } = rango(date);
    const [ventas, cobros, egresos] = await Promise.all([
      this.prisma.invoice.aggregate({ where: { company_id: companyId, estado: { in: ['ACEPTADO', 'OBSERVADO'] as never }, fecha_emision: { gte: inicio, lt: fin } }, _sum: { monto_total: true } }),
      this.prisma.collection.groupBy({
        by: ['payment_method'], where: { company_id: companyId, status: { not: 'ANULADO' }, collection_date: { gte: inicio, lt: fin } },
        _sum: { amount: true },
      }),
      this.prisma.treasuryMovement.groupBy({
        by: ['payment_method'], where: { company_id: companyId, direction: 'EGRESO', movement_date: { gte: inicio, lt: fin } },
        _sum: { amount: true },
      }),
    ]);
    const cobrosPorMetodo = cobros.map((c) => ({ method: c.payment_method, amount: Number(c._sum.amount ?? 0) }));
    const egresosPorMetodo = egresos.map((e) => ({ method: e.payment_method, amount: Number(e._sum.amount ?? 0) }));
    const totalCobros = r2(cobrosPorMetodo.reduce((s, c) => s + c.amount, 0));
    const efectivoCobrado = r2(cobrosPorMetodo.filter((c) => c.method === 'EFECTIVO').reduce((s, c) => s + c.amount, 0));
    const efectivoPagado = r2(egresosPorMetodo.filter((e) => e.method === 'EFECTIVO').reduce((s, e) => s + e.amount, 0));
    return {
      date, salesTotal: r2(Number(ventas._sum.monto_total ?? 0)), collectionsTotal: totalCobros,
      cashCollections: efectivoCobrado, cashExpenses: efectivoPagado, expectedCash: r2(efectivoCobrado - efectivoPagado),
      collectionsByMethod: cobrosPorMetodo, expensesByMethod: egresosPorMetodo,
    };
  }

  async list(companyId: string) {
    const rows = await this.prisma.cashClosure.findMany({ where: { company_id: companyId }, orderBy: { closure_date: 'desc' }, take: 60 });
    return rows.map(map);
  }

  async close(companyId: string, dto: { date: string; countedCash: number; notes?: string; createdBy?: string }) {
    const counted = Number(dto.countedCash);
    if (!(counted >= 0)) throw new BadRequestException('El efectivo contado no puede ser negativo.');
    const dia = fecha(dto.date);
    const existente = await this.prisma.cashClosure.findUnique({ where: { company_id_closure_date: { company_id: companyId, closure_date: dia } } });
    if (existente) throw new ConflictException('La caja de ese día ya fue cerrada.');
    const resumen = await this.summary(companyId, dto.date);
    const row = await this.prisma.cashClosure.create({
      data: {
        company_id: companyId, closure_date: dia, sales_total: resumen.salesTotal, collections_total: resumen.collectionsTotal,
        cash_collections: resumen.cashCollections, cash_expenses: resumen.cashExpenses, expected_cash: resumen.expectedCash,
        counted_cash: counted, difference: r2(counted - resumen.expectedCash), notes: dto.notes?.trim() || null,
        details: { collectionsByMethod: resumen.collectionsByMethod, expensesByMethod: resumen.expensesByMethod },
        created_by: dto.createdBy || null,
      },
    });
    return map(row);
  }
}
