import { Injectable } from '@nestjs/common';
import { CreateAccountingEntryDto } from '../dto/createAccountingEntryDto';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';
import { DoubleEntryRule } from '../../domain/rules/doubleEntryRule';
import { PrismaService } from '../../../../database/prismaService';

@Injectable()
export class GenerateAccountingEntryUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateAccountingEntryDto): Promise<AccountingEntryEntity> {
    // 1. Instanciar la entidad de dominio
    const entry = new AccountingEntryEntity({
      companyId: dto.companyId ?? '',
      period: dto.period,
      entryNumber: dto.entryNumber ?? 1,
      entryDate: new Date(dto.entryDate),
      glosa: dto.glosa,
      sourceModule: dto.sourceModule,
      sourceReferenceId: dto.sourceReferenceId,
      lines: dto.lines.map((l) => ({
        lineOrder: l.lineOrder,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
      })),
    });

    // 2. Validación estricta del Principio de Partida Doble
    DoubleEntryRule.validate(entry);

    // 3. Calcular totales para los campos obligatorios del esquema de Prisma
    const totalDebit = entry.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

    // 4. PERSISTENCIA EN SUPABASE
    try {
      await this.prisma.accountingEntry.create({
        data: {
          company_id: (entry.companyId || dto.companyId) as string,
          period: entry.period,
          entry_number: entry.entryNumber,
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
    }

    return entry;
  }
}