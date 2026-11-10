import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: GenerateAccountingEntryUseCase,
  ) {}

  async list(companyId: string) {
    return this.prisma.expense.findMany({ where: { company_id: companyId }, orderBy: { expense_date: 'desc' }, take: 200 });
  }

  async create(companyId: string, dto: {
    description: string; supplierName: string; supplierDoc?: string; documentType?: string;
    documentNumber?: string; expenseDate?: string; baseAmount: number; igvAmount: number; totalAmount: number;
  }) {
    if (!dto.description?.trim() || !dto.supplierName?.trim()) throw new BadRequestException('Descripción y proveedor son obligatorios.');
    if (!(dto.totalAmount > 0)) throw new BadRequestException('El total del gasto debe ser mayor a cero.');
    const base = Math.round(Number(dto.baseAmount) * 100) / 100;
    const igv = Math.round(Number(dto.igvAmount) * 100) / 100;
    const total = Math.round(Number(dto.totalAmount) * 100) / 100;
    if (Math.abs(base + igv - total) > 0.02) throw new BadRequestException('Base + IGV no coincide con el total del gasto.');
    const fecha = dto.expenseDate ? new Date(dto.expenseDate) : new Date();

    const gasto = await this.prisma.expense.create({
      data: {
        company_id: companyId, expense_date: fecha, supplier_name: dto.supplierName.trim(),
        supplier_doc: dto.supplierDoc?.trim() || null, document_type: dto.documentType ?? '01',
        document_number: dto.documentNumber?.trim() || null, description: dto.description.trim(),
        base_amount: base, igv_amount: igv, total_amount: total, status: 'REGISTRADO',
      },
    });

    const reglas = await this.prisma.accountingRule.findMany({
      where: { company_id: companyId, process_code: 'GASTO', is_active: true }, orderBy: { line_order: 'asc' },
    });
    const porOrden = new Map(reglas.map((r) => [r.line_order, r.account_code]));
    if (reglas.length === 0) throw new BadRequestException('No hay reglas contables para GASTO. Configúrelas antes de registrar el gasto.');
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    await this.accounting.execute({
      companyId, period: periodo, entryDate: fecha.toISOString(),
      glosa: `Gasto ${gasto.description} · ${gasto.supplier_name}`,
      sourceModule: 'EXPENSES', sourceReferenceId: gasto.id, idempotencyKey: `expense:${gasto.id}`,
      lines: [
        { lineOrder: 1, accountCode: porOrden.get(1) ?? '63111', accountName: 'Gasto', debitAmount: base, creditAmount: 0 },
        { lineOrder: 2, accountCode: porOrden.get(2) ?? '40111', accountName: 'IGV crédito fiscal', debitAmount: igv, creditAmount: 0 },
        { lineOrder: 3, accountCode: porOrden.get(3) ?? '42121', accountName: 'Cuentas por pagar', debitAmount: 0, creditAmount: total },
      ],
    });
    return gasto;
  }
}
