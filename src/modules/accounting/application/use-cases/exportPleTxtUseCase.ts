import { Injectable } from '@nestjs/common';
import { ExportPleDto } from '../dto/exportPleDto';
import { PleFileNameRule } from '../../domain/rules/pleFileNameRule';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';

export interface PleExportResult {
  fileName: string;
  recordsCount: number;
  totalDebit: number;
  totalCredit: number;
  content: string;
}

@Injectable()
export class ExportPleTxtUseCase {
  async execute(
    dto: ExportPleDto,
    entries: AccountingEntryEntity[] = [],
  ): Promise<PleExportResult> {
    const fileName = PleFileNameRule.generate({
      ruc: dto.companyRuc,
      year: dto.year,
      month: dto.month,
      bookCode: dto.bookCode,
      hasInformation: entries.length > 0,
    });

    let totalDebit = 0;
    let totalCredit = 0;
    const lines: string[] = [];

    entries.forEach((entry, entryIndex) => {
      // Formateo estricto del CUO para SUNAT (ej. 001-202610-001)
      const rawEntryNumber = entry.entryNumber ? String(entry.entryNumber) : '';
      const isFormattedCuo = /^\d{3}-\d{6}-\d{3,}$/.test(rawEntryNumber);

      const cuo = isFormattedCuo
        ? rawEntryNumber
        : `001-${dto.year}${String(dto.month).padStart(2, '0')}-${String(entryIndex + 1).padStart(3, '0')}`;

      entry.lines.forEach((line, lineIdx) => {
        const debitVal = Number(line.debitAmount ?? (line as any).debit_amount ?? 0);
        const creditVal = Number(line.creditAmount ?? (line as any).credit_amount ?? 0);

        totalDebit += debitVal;
        totalCredit += creditVal;

        const lineOrderNum = line.lineOrder ?? (line as any).line_order ?? (lineIdx + 1);
        const lineCorrelative = `M${String(lineOrderNum).padStart(3, '0')}`;
        const accountCode = line.accountCode || (line as any).account_code || '';

        const record = [
          `${dto.year}${String(dto.month).padStart(2, '0')}00`,
          cuo,
          lineCorrelative,
          accountCode,
          debitVal.toFixed(2),
          creditVal.toFixed(2),
          entry.glosa || '',
          '1',
          '',
        ].join('|');

        lines.push(record);
      });
    });

    const content = lines.length > 0 ? lines.join('\r\n') + '\r\n' : '';

    return {
      fileName,
      recordsCount: lines.length,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      content,
    };
  }
}