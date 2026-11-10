import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService, private readonly accounting: GenerateAccountingEntryUseCase) {}

  async list(companyId: string) {
    return this.prisma.collection.findMany({ where: { company_id: companyId }, orderBy: { collection_date: 'desc' }, take: 200 });
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
      sourceModule: 'COLLECTIONS', sourceReferenceId: `ANUL-${id}`, idempotencyKey: `collection-annul:${id}`,
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

    const cobro = await this.prisma.collection.create({
      data: {
        company_id: companyId, collection_date: fecha, customer_name: dto.customerName.trim(),
        customer_doc: dto.customerDoc?.trim() || null, invoice_number: dto.invoiceNumber?.trim() || null, invoice_id: invoiceId,
        description: dto.description?.trim() || `Cobro a ${dto.customerName.trim()}`, amount: monto,
        payment_method: metodo, bank_name: dto.bankName?.trim() || null, status: 'REGISTRADO',
      },
    });

    const reglas = await this.prisma.accountingRule.findMany({
      where: { company_id: companyId, process_code: 'COBRO', is_active: true }, orderBy: { line_order: 'asc' },
    });
    if (reglas.length === 0) throw new BadRequestException('No hay reglas contables para COBRO. Configúrelas antes de registrar el cobro.');
    const porOrden = new Map(reglas.map((r) => [r.line_order, r.account_code]));
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    await this.accounting.execute({
      companyId, period: periodo, entryDate: fecha.toISOString(),
      glosa: `Cobro de ${cobro.customer_name}${cobro.invoice_number ? ` · ${cobro.invoice_number}` : ''}`,
      sourceModule: 'COLLECTIONS', sourceReferenceId: cobro.id, idempotencyKey: `collection:${cobro.id}`,
      lines: [
        { lineOrder: 1, accountCode: metodo === 'EFECTIVO' ? '101' : (porOrden.get(1) ?? '1041'), accountName: 'Caja o banco', debitAmount: monto, creditAmount: 0 },
        { lineOrder: 2, accountCode: porOrden.get(2) ?? '12121', accountName: 'Cuentas por cobrar', debitAmount: 0, creditAmount: monto },
      ],
    });
    return cobro;
  }
}
