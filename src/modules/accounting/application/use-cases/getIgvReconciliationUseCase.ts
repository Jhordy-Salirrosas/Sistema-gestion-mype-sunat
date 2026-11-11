import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class GetIgvReconciliationUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(companyId: string, period: string) {
    if (!/^\d{4}-\d{2}$/.test(period)) throw new BadRequestException('Período inválido. Use YYYY-MM.');
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7));
    if (month < 1 || month > 12) throw new BadRequestException('Mes inválido.');
    const desde = new Date(Date.UTC(year, month - 1, 1));
    const hasta = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const [ventas, compras, gastos, lineas] = await Promise.all([
      this.prisma.invoice.findMany({ where: { company_id: companyId, fecha_emision: { gte: desde, lte: hasta }, estado: { in: ['ACEPTADO', 'OBSERVADO'] } }, select: { total_igv: true, taxable_operations: true } }),
      this.prisma.nationalPurchase.findMany({ where: { company_id: companyId, issue_date: { gte: desde, lte: hasta }, status: { not: 'ANULADA' } }, select: { igv_amount: true, net_amount: true } }),
      this.prisma.expense.findMany({ where: { company_id: companyId, expense_date: { gte: desde, lte: hasta }, status: { not: 'ANULADO' } }, select: { igv_amount: true } }),
      this.prisma.accountingLine.findMany({ where: { entry: { company_id: companyId, period, status: 'ASENTADO' }, account_code: { startsWith: '4011' } }, select: { debit_amount: true, credit_amount: true } }),
    ]);

    const igvVentas = r2(ventas.reduce((s, v) => s + Number(v.total_igv), 0));
    const igvCompras = r2(compras.reduce((s, c) => s + Number(c.igv_amount), 0));
    const igvGastos = r2(gastos.reduce((s, g) => s + Number(g.igv_amount), 0));
    const esperado = r2(igvVentas - igvCompras - igvGastos);
    const contable = r2(lineas.reduce((s, l) => s + Number(l.credit_amount) - Number(l.debit_amount), 0));
    const diferencia = r2(contable - esperado);
    return {
      period,
      sales: { taxable: r2(ventas.reduce((s, v) => s + Number(v.taxable_operations), 0)), igv: igvVentas, documents: ventas.length },
      purchases: { net: r2(compras.reduce((s, c) => s + Number(c.net_amount), 0)), igv: igvCompras, documents: compras.length },
      expenses: { igv: igvGastos, documents: gastos.length },
      expected: esperado,
      accounting: contable,
      difference: diferencia,
      reconciled: Math.abs(diferencia) <= 0.1,
    };
  }
}
