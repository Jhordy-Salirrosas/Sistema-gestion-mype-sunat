import { Injectable } from '@nestjs/common';
import { IAccountingRepositoryPort } from '../domain/ports/accountingRepositoryPort';
import { AccountingEntryEntity } from '../domain/entities/accountingEntryEntity';
import { PrismaService } from '../../../database/prismaService';

@Injectable()
export class PrismaAccountingRepository implements IAccountingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getNextEntryNumber(companyId: string, period: string): Promise<number> {
    const count = await this.prisma.accountingEntry.count({
      where: {
        company_id: companyId,
        period: period,
      },
    });
    return count + 1;
  }

  async saveEntry(entry: AccountingEntryEntity): Promise<AccountingEntryEntity> {
    const totalDebit = entry.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

    try {
      await this.prisma.accountingEntry.create({
        data: {
          company_id: entry.companyId,
          period: entry.period,
          entry_number: Number(entry.entryNumber),
          entry_date: entry.entryDate,
          glosa: entry.glosa,
          source_module: entry.sourceModule,
          source_reference_id: entry.sourceReferenceId,
          total_debit: totalDebit,
          total_credit: totalCredit,
          is_balanced: isBalanced,
          lines: {
            create: entry.lines.map((l) => ({
              line_order: l.lineOrder,
              account_code: l.accountCode,
              account_name: l.accountName,
              debit_amount: l.debitAmount,
              credit_amount: l.creditAmount,
            })),
          },
        },
      });
      console.log('✅ ¡ASIENTO GUARDADO EXITOSAMENTE EN SUPABASE!');
    } catch (error) {
      console.error('❌ ERROR AL GUARDAR EN SUPABASE:', error);
      throw error;
    }

    return entry;
  }

  async findEntriesByPeriod(companyId: string, period: string): Promise<AccountingEntryEntity[]> {
    const entries = await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, period },
      include: { lines: true },
      orderBy: { entry_number: 'asc' },
    });

    return entries.map(
      (e) =>
        new AccountingEntryEntity({
          id: e.id,
          companyId: e.company_id,
          period: e.period,
          entryNumber: e.entry_number,
          entryDate: e.entry_date,
          glosa: e.glosa,
          sourceModule: e.source_module,
          sourceReferenceId: e.source_reference_id ?? undefined,
          lines: e.lines.map((l: any) => ({
            lineOrder: l.line_order ?? l.lineOrder,
            accountCode: l.account_code ?? l.accountCode,
            accountName: l.account_name ?? l.accountName,
            debitAmount: Number(l.debit_amount ?? l.debitAmount ?? 0),
            creditAmount: Number(l.credit_amount ?? l.creditAmount ?? 0),
          })),
        }),
    );
  }
}