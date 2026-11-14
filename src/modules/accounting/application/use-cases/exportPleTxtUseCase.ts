import { BadRequestException, Injectable } from '@nestjs/common';
import { ExportPleDto } from '../dto/exportPleDto';
import { PleFileNameRule } from '../../domain/rules/pleFileNameRule';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';
import { construirLinea, validarEstructura, validarRucEmisor } from '../../domain/rules/pleStructureRule';

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
    const ruc = (dto.companyRuc ?? '').replace(/\s/g, '');
    const problemaRuc = validarRucEmisor(ruc);
    if (problemaRuc) throw new BadRequestException(problemaRuc);

    const fileName = PleFileNameRule.generate({
      ruc,
      year: dto.year,
      month: dto.month,
      bookCode: dto.bookCode,
      hasInformation: entries.length > 0,
    });

    const periodo = `${dto.year}${String(dto.month).padStart(2, '0')}00`;
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
        lines.push(
          construirLinea([
            periodo,
            `001-${dto.year}${String(dto.month).padStart(2, '0')}-${String(index).padStart(3, '0')}`,
            code,
            cuenta.name,
            cuenta.debit.toFixed(2),
            cuenta.credit.toFixed(2),
            '1',
          ]),
        );
      }
      this.exigirFormato(lines, '030100');
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

      // Campo 3: el primer dígito del correlativo indica el tipo de asiento
      // (A apertura, M movimiento, C cierre). Todo lo que emite el sistema es
      // movimiento del mes. Si el número viene formateado como CUO, se usa la
      // posición del asiento en el período.
      const numeroAsiento = /^\d+$/.test(rawEntryNumber) ? Number(rawEntryNumber) : entryIndex + 1;
      const correlativoAsiento = `M${String(numeroAsiento).padStart(3, '0')}`;
      const fechaContable = this.fecha(entry.entryDate);

      entry.lines.forEach((line) => {
        const debitVal = Number(line.debitAmount ?? (line as any).debit_amount ?? 0);
        const creditVal = Number(line.creditAmount ?? (line as any).credit_amount ?? 0);

        totalDebit += debitVal;
        totalCredit += creditVal;

        const accountCode = line.accountCode || (line as any).account_code || '';

        // Estructura oficial del 5.1: 21 columnas (22-44 quedan libres y no se
        // emiten). Los campos 5 y 6 (unidad de operación y centro de costos),
        // 8 a 12 (documento del emisor y comprobante) y 14, 15 y 17 no tienen
        // dato en el asiento, así que van vacíos y no se inventan.
        lines.push(
          construirLinea([
            periodo, // 1 período
            cuo, // 2 CUO
            correlativoAsiento, // 3 correlativo del asiento
            accountCode, // 4 cuenta contable
            '', // 5 unidad de operación
            '', // 6 centro de costos
            'PEN', // 7 moneda
            '', // 8 tipo de documento del emisor
            '', // 9 número de documento del emisor
            '', // 10 tipo de comprobante
            '', // 11 serie
            '', // 12 número
            fechaContable, // 13 fecha contable
            '', // 14 fecha de vencimiento
            '', // 15 fecha de la operación
            entry.glosa || '', // 16 glosa
            '', // 17 glosa referencial
            debitVal.toFixed(2), // 18 debe
            creditVal.toFixed(2), // 19 haber
            '', // 20 dato estructurado
            '1', // 21 estado de la operación
          ]),
        );
      });
    });

    this.exigirFormato(lines, String(dto.bookCode));

    return {
      fileName,
      recordsCount: lines.length,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      content: lines.length > 0 ? lines.join('\r\n') + '\r\n' : '',
    };
  }

  /**
   * Un archivo con filas de distinto número de columnas lo rechaza SUNAT sin
   * decir en qué línea: se corta acá, con el número de línea.
   */
  private exigirFormato(lines: readonly string[], bookCode: string): void {
    const issues = validarEstructura(lines);
    if (issues.length > 0) {
      throw new BadRequestException(
        `El libro ${bookCode} tiene una fila con formato inconsistente: ${issues[0].message}`,
      );
    }
  }

  /** Fecha `DD/MM/YYYY` como la espera el PLE. */
  private fecha(valor: Date | string | undefined): string {
    if (!valor) return '';
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }
}
