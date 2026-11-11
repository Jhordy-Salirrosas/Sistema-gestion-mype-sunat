import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService, private readonly accounting: GenerateAccountingEntryUseCase) {}

  async list(companyId: string) {
    return this.prisma.collection.findMany({ where: { company_id: companyId }, orderBy: { collection_date: 'desc' }, take: 200 });
  }

  async reconciliation(companyId: string) {
    const facturas = await this.prisma.invoice.findMany({
      where: { company_id: companyId, estado: { in: ['ACEPTADO', 'OBSERVADO'] } },
      select: { id: true, monto_total: true },
    });
    let cartera = 0;
    for (const f of facturas) cartera += (await this.saldoFactura(companyId, f.id, Number(f.monto_total))).saldo;
    const lineas = await this.prisma.accountingLine.findMany({
      where: { entry: { company_id: companyId, status: 'ASENTADO' }, account_code: { startsWith: '121' } },
      select: { debit_amount: true, credit_amount: true },
    });
    const contabilidad = lineas.reduce((s, l) => s + Number(l.debit_amount) - Number(l.credit_amount), 0);
    const diferencia = Math.round((cartera - contabilidad) * 100) / 100;
    return {
      receivable: Math.round(cartera * 100) / 100,
      accounting: Math.round(contabilidad * 100) / 100,
      difference: diferencia,
      reconciled: Math.abs(diferencia) <= 0.1,
      invoiceCount: facturas.length,
    };
  }

  async invoiceCollections(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, company_id: companyId },
      select: { id: true, serie: true, correlativo: true, customer_legal_name: true, monto_total: true, fecha_emision: true },
    });
    if (!invoice) throw new BadRequestException('Comprobante no encontrado.');
    const cobros = await this.prisma.collection.findMany({
      where: { company_id: companyId, invoice_id: invoiceId, status: { not: 'ANULADO' } },
      orderBy: { collection_date: 'desc' },
    });
    return {
      invoice: { id: invoice.id, numero: `${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}`, customerName: invoice.customer_legal_name, total: Number(invoice.monto_total), date: invoice.fecha_emision },
      collections: cobros.map((c) => ({ id: c.id, date: c.collection_date, amount: Number(c.amount), paymentMethod: c.payment_method, bankName: c.bank_name, status: c.status })),
      paid: Math.round(cobros.reduce((s, c) => s + Number(c.amount), 0) * 100) / 100,
    };
  }

  async portfolioAging(companyId: string) {
    const facturas = await this.prisma.invoice.findMany({
      where: { company_id: companyId, estado: { in: ['ACEPTADO', 'OBSERVADO'] } },
      select: { id: true, customer_identity_number: true, customer_legal_name: true, monto_total: true, fecha_emision: true },
    });
    const aging = { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    const porCliente = new Map<string, { doc: string; name: string; balance: number }>();
    let total = 0;
    let count = 0;
    let overdueCount = 0;
    let overdueTotal = 0;
    const hoy = Date.now();
    for (const f of facturas) {
      const { saldo } = await this.saldoFactura(companyId, f.id, Number(f.monto_total));
      if (saldo <= 0.005) continue;
      count += 1; total += saldo;
      const dias = Math.max(0, Math.floor((hoy - new Date(f.fecha_emision).getTime()) / 86400000));
      if (dias > 30) { overdueCount += 1; overdueTotal += saldo; }
      if (dias <= 30) aging.d0_30 += saldo;
      else if (dias <= 60) aging.d31_60 += saldo;
      else if (dias <= 90) aging.d61_90 += saldo;
      else aging.d90_plus += saldo;
      const key = f.customer_identity_number || f.customer_legal_name || '';
      const actual = porCliente.get(key) ?? { doc: f.customer_identity_number ?? '', name: f.customer_legal_name ?? '', balance: 0 };
      actual.balance += saldo;
      porCliente.set(key, actual);
    }
    for (const k of Object.keys(aging) as Array<keyof typeof aging>) aging[k] = Math.round(aging[k] * 100) / 100;
    const deudores = [...porCliente.values()]
      .map((d) => ({ ...d, balance: Math.round(d.balance * 100) / 100 }))
      .sort((a, b) => b.balance - a.balance).slice(0, 10);
    return { total: Math.round(total * 100) / 100, invoiceCount: count, overdue: { count: overdueCount, total: Math.round(overdueTotal * 100) / 100 }, aging, debtors: deudores };
  }

  async customerStatement(companyId: string, customerDoc: string) {
    if (!customerDoc?.trim()) throw new BadRequestException('El documento del cliente es obligatorio.');
    const facturas = await this.prisma.invoice.findMany({
      where: { company_id: companyId, customer_identity_number: customerDoc.trim(), estado: { in: ['ACEPTADO', 'OBSERVADO'] } },
      orderBy: { fecha_emision: 'desc' },
      select: { id: true, serie: true, correlativo: true, monto_total: true, fecha_emision: true },
    });
    const filas = [];
    let total = 0;
    let acreditado = 0;
    let cobrado = 0;
    let saldo = 0;
    const aging = { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    const hoy = Date.now();
    for (const f of facturas) {
      const s = await this.saldoFactura(companyId, f.id, Number(f.monto_total));
      total += Number(f.monto_total); acreditado += s.acreditado; cobrado += s.cobrado; saldo += s.saldo;
      const dias = Math.max(0, Math.floor((hoy - new Date(f.fecha_emision).getTime()) / 86400000));
      if (s.saldo > 0.005) {
        if (dias <= 30) aging.d0_30 += s.saldo;
        else if (dias <= 60) aging.d31_60 += s.saldo;
        else if (dias <= 90) aging.d61_90 += s.saldo;
        else aging.d90_plus += s.saldo;
      }
      filas.push({ id: f.id, numero: `${f.serie}-${String(f.correlativo).padStart(8, '0')}`, date: f.fecha_emision, total: Number(f.monto_total), credited: s.acreditado, paid: s.cobrado, balance: s.saldo, days: dias });
    }
    for (const k of Object.keys(aging) as Array<keyof typeof aging>) aging[k] = Math.round(aging[k] * 100) / 100;
    const cobros = await this.prisma.collection.findMany({ where: { company_id: companyId, customer_doc: customerDoc.trim(), status: { not: 'ANULADO' } }, orderBy: { collection_date: 'desc' }, select: { id: true, collection_date: true, invoice_number: true, amount: true, payment_method: true } });
    return { customerDoc: customerDoc.trim(), invoices: filas, collections: cobros.map((c) => ({ id: c.id, date: c.collection_date, invoiceNumber: c.invoice_number, amount: Number(c.amount), paymentMethod: c.payment_method })), aging, totals: { total: Math.round(total * 100) / 100, credited: Math.round(acreditado * 100) / 100, paid: Math.round(cobrado * 100) / 100, balance: Math.round(saldo * 100) / 100 } };
  }

  async annul(companyId: string, id: string) {
    const cobro = await this.prisma.collection.findFirst({ where: { id, company_id: companyId } });
    if (!cobro) throw new BadRequestException('Cobro no encontrado.');
    if (cobro.status === 'ANULADO') throw new BadRequestException('El cobro ya está anulado.');
    const original = await this.prisma.accountingEntry.findFirst({
      where: { company_id: companyId, source_module: 'COLLECTIONS', source_reference_id: id },
      include: { lines: true },
    });
    if (!original) throw new BadRequestException('El cobro no tiene asiento contable; no se puede anular.');
    const fecha = new Date();
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    await this.prisma.treasuryMovement.create({ data: {
      company_id: companyId, movement_date: fecha, direction: 'INGRESO',
      document_reference: cobro.invoice_number ?? cobro.id, counterpart_name: cobro.customer_name,
      concept: `Devolución por anulación de cobro ${cobro.id}`, amount: Number(cobro.amount),
      source_module: 'COLLECTIONS', source_reference_id: cobro.id, payment_method: cobro.payment_method,
      bank_name: cobro.bank_name ?? null,
    } });
    await this.accounting.execute({
      companyId, period: periodo, entryDate: fecha.toISOString(), glosa: `Anulación cobro ${cobro.customer_name}`,
      sourceModule: 'COLLECTIONS', journalCode: 'CAJ', sourceReferenceId: `ANUL-${id}`, idempotencyKey: `collection-annul:${id}`,
      lines: original.lines.map((l, i) => ({ lineOrder: i + 1, accountCode: l.account_code, accountName: l.account_name, debitAmount: Number(l.credit_amount), creditAmount: Number(l.debit_amount) })),
    });
    return this.prisma.collection.update({ where: { id }, data: { status: 'ANULADO' } });
  }

  /** Saldo real: total factura - notas de crédito - cobros. */
  private async saldoFactura(companyId: string, invoiceId: string, total: number) {
    const [notas, cobros] = await Promise.all([
      this.prisma.invoice.aggregate({ where: { company_id: companyId, referenced_invoice_id: invoiceId, tipo_comprobante: '07', estado: { in: ['ACEPTADO', 'OBSERVADO'] } }, _sum: { monto_total: true } }),
      this.prisma.collection.aggregate({ where: { company_id: companyId, invoice_id: invoiceId, status: { not: 'ANULADO' } }, _sum: { amount: true } }),
    ]);
    const acreditado = Number(notas._sum.monto_total ?? 0);
    const cobrado = Number(cobros._sum.amount ?? 0);
    return { acreditado, cobrado, saldo: Math.round((total - acreditado - cobrado) * 100) / 100 };
  }

  async listReceivables(companyId: string) {
    const facturas = await this.prisma.invoice.findMany({
      where: { company_id: companyId, estado: { in: ['ACEPTADO', 'OBSERVADO'] } },
      orderBy: [{ fecha_emision: 'desc' }], take: 200,
      select: { id: true, serie: true, correlativo: true, customer_legal_name: true, customer_identity_number: true, monto_total: true, fecha_emision: true },
    });
    const resultado = [];
    for (const f of facturas) {
      const { acreditado, saldo } = await this.saldoFactura(companyId, f.id, Number(f.monto_total));
      if (saldo > 0.005) resultado.push({
        id: f.id, numero: `${f.serie}-${String(f.correlativo).padStart(8, '0')}`,
        customerName: f.customer_legal_name, customerDoc: f.customer_identity_number,
        total: Number(f.monto_total), credited: acreditado, paid: Math.round((Number(f.monto_total) - acreditado - saldo) * 100) / 100,
        balance: saldo, date: f.fecha_emision,
      });
    }
    return resultado;
  }

  async create(companyId: string, dto: {
    customerName: string; customerDoc?: string; invoiceNumber?: string; description?: string;
    collectionDate?: string; paymentMethod?: string; bankName?: string; amount: number;
  }) {
    if (!dto.customerName?.trim()) throw new BadRequestException('El cliente es obligatorio.');
    if (!(Number(dto.amount) > 0)) throw new BadRequestException('El monto del cobro debe ser mayor a cero.');
    const fecha = dto.collectionDate ? new Date(dto.collectionDate) : new Date();
    const monto = Math.round(Number(dto.amount) * 100) / 100;

    let invoiceId: string | null = null;
    if (dto.invoiceNumber?.trim()) {
      const numero = dto.invoiceNumber.trim().toUpperCase();
      const match = /^([A-Z0-9]+)-0*(\d+)$/.exec(numero);
      if (!match) throw new BadRequestException('El comprobante debe tener formato F001-00000001.');
      const invoice = await this.prisma.invoice.findFirst({
        where: { company_id: companyId, serie: match[1], correlativo: Number(match[2]) },
        select: { id: true, monto_total: true, estado: true },
      });
      if (!invoice) throw new BadRequestException(`El comprobante ${numero} no existe en la empresa.`);
      if (!['ACEPTADO', 'OBSERVADO'].includes(invoice.estado)) throw new BadRequestException(`El comprobante ${numero} no está aceptado por SUNAT.`);
      const { saldo } = await this.saldoFactura(companyId, invoice.id, Number(invoice.monto_total));
      if (monto > saldo + 0.005) throw new BadRequestException(`El cobro supera el saldo del comprobante (S/ ${saldo.toFixed(2)}).`);
      invoiceId = invoice.id;
    }
    const metodo = dto.paymentMethod ?? 'TRANSFERENCIA';

    const reglas = await this.prisma.accountingRule.findMany({
      where: { company_id: companyId, process_code: 'COBRO', is_active: true }, orderBy: { line_order: 'asc' },
    });
    const lineas = new Set(reglas.map((r) => r.line_order));
    if (reglas.length === 0 || ![1, 2].every((n) => lineas.has(n))) {
      throw new BadRequestException('Las reglas COBRO están incompletas: se requieren las líneas 1 y 2.');
    }

    const cobro = await this.prisma.collection.create({
      data: {
        company_id: companyId, collection_date: fecha, customer_name: dto.customerName.trim(),
        customer_doc: dto.customerDoc?.trim() || null, invoice_number: dto.invoiceNumber?.trim() || null, invoice_id: invoiceId,
        description: dto.description?.trim() || `Cobro a ${dto.customerName.trim()}`, amount: monto,
        payment_method: metodo, bank_name: dto.bankName?.trim() || null, status: 'REGISTRADO',
      },
    });

    const porOrden = new Map(reglas.map((r) => [r.line_order, r.account_code]));
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    await this.accounting.execute({
      companyId, period: periodo, entryDate: fecha.toISOString(),
      glosa: `Cobro de ${cobro.customer_name}${cobro.invoice_number ? ` · ${cobro.invoice_number}` : ''}`,
      sourceModule: 'COLLECTIONS', journalCode: 'CAJ', sourceReferenceId: cobro.id, idempotencyKey: `collection:${cobro.id}`,
      lines: [
        { lineOrder: 1, accountCode: metodo === 'EFECTIVO' ? '101' : (porOrden.get(1) ?? '1041'), accountName: 'Caja o banco', debitAmount: monto, creditAmount: 0 },
        { lineOrder: 2, accountCode: porOrden.get(2) ?? '12121', accountName: 'Cuentas por cobrar', debitAmount: 0, creditAmount: monto },
      ],
    });
    return cobro;
  }
}
