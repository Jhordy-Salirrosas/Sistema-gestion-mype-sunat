import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService, private readonly accounting: GenerateAccountingEntryUseCase) {}

  async list(companyId: string) {
    return this.prisma.collection.findMany({ where: { company_id: companyId }, orderBy: { collection_date: 'desc' }, take: 200 });
  }

  async create(companyId: string, dto: {
    customerName: string; customerDoc?: string; invoiceNumber?: string; description?: string;
    collectionDate?: string; paymentMethod?: string; bankName?: string; amount: number;
  }) {
    if (!dto.customerName?.trim()) throw new BadRequestException('El cliente es obligatorio.');
    if (!(Number(dto.amount) > 0)) throw new BadRequestException('El monto del cobro debe ser mayor a cero.');
    const fecha = dto.collectionDate ? new Date(dto.collectionDate) : new Date();
    const monto = Math.round(Number(dto.amount) * 100) / 100;
    const metodo = dto.paymentMethod ?? 'TRANSFERENCIA';

    const cobro = await this.prisma.collection.create({
      data: {
        company_id: companyId, collection_date: fecha, customer_name: dto.customerName.trim(),
        customer_doc: dto.customerDoc?.trim() || null, invoice_number: dto.invoiceNumber?.trim() || null,
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
