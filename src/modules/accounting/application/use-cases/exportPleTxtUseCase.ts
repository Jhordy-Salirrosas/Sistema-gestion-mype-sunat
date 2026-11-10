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

    // 3.1 Libro de Inventarios y Balances: una línea por cuenta con sus saldos.
    // El 7.1 es Registro de Activos Fijos y no debe rotularse como balances.
    if (String(dto.bookCode) === '030100') {
      const cuentas = new Map<string, { name: string; debit: number; credit: number }>();
      for (const entry of entries) {
        for (const line of entry.lines) {
          const code = line.accountCode || (line as any).account_code || '';
          const debit = Number(line.debitAmount ?? (line as any).debit_amount ?? 0);
          const credit = Number(line.creditAmount ?? (line as any).credit_amount ?? 0);
          const actual = cuentas.get(code) ?? { name: line.accountName || '', debit: 0, credit: 0 };
          actual.debit += debit;
          actual.credit += credit;
          cuentas.set(code, actual);
        }
      }
      let index = 0;
      for (const [code, cuenta] of [...cuentas.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        index += 1;
        totalDebit += cuenta.debit;
        totalCredit += cuenta.credit;
        lines.push([
          `${dto.year}${String(dto.month).padStart(2, '0')}00`,
          `001-${dto.year}${String(dto.month).padStart(2, '0')}-${String(index).padStart(3, '0')}`,
          code,
          cuenta.name,
          cuenta.debit.toFixed(2),
          cuenta.credit.toFixed(2),
          '1',
        ].join('|'));
      }
      return {
        fileName,
        recordsCount: lines.length,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        content: lines.length > 0 ? lines.join('\r\n') + '\r\n' : '',
      };
    }

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