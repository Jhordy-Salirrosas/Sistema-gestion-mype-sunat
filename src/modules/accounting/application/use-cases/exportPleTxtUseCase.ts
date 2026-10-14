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
      entry.lines.forEach((line) => {
        totalDebit += line.debitAmount;
        totalCredit += line.creditAmount;

        // Formato estructurado PLE delimitado por tuberías |
        const record = [
          `${dto.year}${String(dto.month).padStart(2, '0')}00`, // Periodo
          `${entryIndex + 1}_${line.lineOrder}`, // Correlativo / CUO
          `M${line.lineOrder}`, // Número correlativo del asiento
          line.accountCode, // Código de cuenta PCGE
          line.debitAmount.toFixed(2), // Monto Debe
          line.creditAmount.toFixed(2), // Monto Haber
          entry.glosa, // Glosa
          '1', // Estado de la operación
          '', // Campo final obligatorio con tubería
        ].join('|');

        lines.push(record);
      });
    });

    return {
      fileName,
      recordsCount: lines.length,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      content: lines.join('\r\n'),
    };
  }
}
