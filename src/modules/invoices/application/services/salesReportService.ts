import { fechaFiscalLima } from '../../fiscalDate';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

export interface SalesReportResult {
  from: string;
  to: string;
  totals: { sales: number; taxable: number; igv: number; cost: number; profit: number; margin: number; documents: number; withoutCost: { count: number; sales: number }; }
  byCustomer: Array<{ document: string; customer: string; sales: number; taxable: number; igv: number; cost: number; profit: number | null; documents: number }>;
  byDocument: Array<{ id: string; number: string; date: string; customer: string; total: number; taxable: number; igv: number; cost: number; profit: number | null; hasCost: boolean }>;
  daily: Array<{ date: string; sales: number; taxable: number; igv: number; cost: number; profit: number | null }>;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class SalesReportService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(companyId: string, from?: string, to?: string): Promise<SalesReportResult> {
    const hoy = new Date(`${fechaFiscalLima()}T00:00:00Z`);
    const inicio = from ? new Date(`${from}T00:00:00Z`) : new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const fin = to ? new Date(`${to}T23:59:59Z`) : new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) throw new BadRequestException('Fechas inválidas.');
    if (inicio > fin) throw new BadRequestException('La fecha inicial no puede ser mayor que la final.');

    const facturas = await this.prisma.invoice.findMany({
      where: { company_id: companyId, fecha_emision: { gte: inicio, lte: fin }, estado: { in: ['ACEPTADO', 'OBSERVADO'] } },
      orderBy: [{ fecha_emision: 'asc' }, { correlativo: 'asc' }],
      select: { id: true, tipo_comprobante: true, serie: true, correlativo: true, fecha_emision: true, customer_identity_number: true, customer_legal_name: true, monto_total: true, taxable_operations: true, total_igv: true },
    });

    const ids = facturas.map((f) => f.id);
    const referenciasCosto = ids.map((id) => `${id}:COSTO`);
    const asientos = ids.length === 0 ? [] : await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, source_module: 'M1_INVOICES', source_reference_id: { in: referenciasCosto } },
      include: { lines: true },
    });
    const costoPorFactura = new Map<string, number>();
    for (const asiento of asientos) {
      const costo = asiento.lines
        .filter((l) => l.account_code.startsWith('69'))
        .reduce((s, l) => s + Number(l.debit_amount) - Number(l.credit_amount), 0);
      const facturaId = String(asiento.source_reference_id).replace(/:COSTO$/, '');
      costoPorFactura.set(facturaId, r2((costoPorFactura.get(facturaId) ?? 0) + costo));
    }

    type Group = { sales: number; taxable: number; igv: number; cost: number; profit: number | null };
    const porCliente = new Map<string, Group & { document: string; customer: string; documents: number }>();
    const porDia = new Map<string, Group>();
    const documentos: SalesReportResult['byDocument'] = [];
    let ventas = 0, base = 0, igv = 0, costo = 0, baseConCosto = 0, utilidadTotal = 0, sinCosto = 0, ventasSinCosto = 0;

    for (const f of facturas) {
      const signo = f.tipo_comprobante === '07' ? -1 : 1;
      const total = signo * Number(f.monto_total);
      const baseFirmada = signo * Number(f.taxable_operations);
      const c = costoPorFactura.get(f.id) ?? 0;
      const tieneCosto = costoPorFactura.has(f.id);
      const utilidad = tieneCosto ? r2(baseFirmada - c) : null;
      ventas += total; base += baseFirmada; igv += signo * Number(f.total_igv); costo += c;
      if (tieneCosto) { baseConCosto += baseFirmada; utilidadTotal += utilidad!; }
      else if (f.tipo_comprobante === '01' || f.tipo_comprobante === '03') { sinCosto += 1; ventasSinCosto += total; }
      const numero = `${f.serie}-${String(f.correlativo).padStart(8, '0')}`;
      documentos.push({ id: f.id, number: numero, date: f.fecha_emision.toISOString().slice(0, 10), customer: f.customer_legal_name ?? '', total: r2(total), taxable: r2(baseFirmada), igv: r2(signo * Number(f.total_igv)), cost: c, profit: utilidad, hasCost: tieneCosto });
      const key = f.customer_identity_number || f.customer_legal_name || '';
      const actual = porCliente.get(key) ?? { document: f.customer_identity_number ?? '', customer: f.customer_legal_name ?? '', sales: 0, taxable: 0, igv: 0, cost: 0, profit: null, documents: 0 };
      actual.sales += total; actual.taxable += baseFirmada; actual.igv += signo * Number(f.total_igv); actual.cost += c; if (utilidad !== null) actual.profit = (actual.profit ?? 0) + utilidad; actual.documents += 1;
      porCliente.set(key, actual);
      const dia = f.fecha_emision.toISOString().slice(0, 10);
      const d = porDia.get(dia) ?? { sales: 0, taxable: 0, igv: 0, cost: 0, profit: null };
      d.sales += total; d.taxable += baseFirmada; d.igv += signo * Number(f.total_igv); d.cost += c; if (utilidad !== null) d.profit = (d.profit ?? 0) + utilidad;
      porDia.set(dia, d);
    }

    const redondear = <T extends Group>(x: T) => ({ ...x, sales: r2(x.sales), taxable: r2(x.taxable), igv: r2(x.igv), cost: r2(x.cost), profit: x.profit === null ? null : r2(x.profit) });
    const totales = { sales: r2(ventas), taxable: r2(base), igv: r2(igv), cost: r2(costo), profit: r2(utilidadTotal), margin: baseConCosto !== 0 ? r2(utilidadTotal / baseConCosto * 100) : 0, documents: facturas.length, withoutCost: { count: sinCosto, sales: r2(ventasSinCosto) } };
    return {
      from: inicio.toISOString().slice(0, 10), to: fin.toISOString().slice(0, 10), totals: totales,
      byCustomer: [...porCliente.values()].map(redondear).sort((a, b) => b.sales - a.sales),
      byDocument: documentos.sort((a, b) => b.date.localeCompare(a.date)),
      daily: [...porDia.entries()].map(([date, v]) => ({ date, ...redondear(v) })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}
