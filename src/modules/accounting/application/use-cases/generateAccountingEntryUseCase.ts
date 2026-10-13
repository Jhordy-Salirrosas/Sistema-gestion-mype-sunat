import { Injectable } from '@nestjs/common';
import { CreateAccountingEntryDto } from '../dto/createAccountingEntryDto';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';
import { DoubleEntryRule } from '../../domain/rules/doubleEntryRule';

@Injectable()
export class GenerateAccountingEntryUseCase {
  async execute(dto: CreateAccountingEntryDto): Promise<AccountingEntryEntity> {
    const entry = new AccountingEntryEntity({
      companyId: dto.companyId,
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

    // Validación estricta del Principio de Partida Doble
    DoubleEntryRule.validate(entry);

    return entry;
  }
}
