import { BadRequestException } from '@nestjs/common';
import { AccountingEntryEntity } from '../entities/accountingEntryEntity';

export class DoubleEntryRule {
  /**
   * Valida el principio de partida doble: Total Debe === Total Haber.
   * Tolerancia centesimal máxima de 0.01 por redondeos.
   */
  static validate(entry: AccountingEntryEntity): void {
    if (entry.lines.length < 2) {
      throw new BadRequestException(
        'El asiento contable debe tener al menos dos líneas para cumplir partida doble',
      );
    }

    const totalDebit = entry.getTotalDebit();
    const totalCredit = entry.getTotalCredit();
    const difference = Math.abs(totalDebit - totalCredit);

    if (difference > 0.01) {
      throw new BadRequestException(
        `Descuadre en asiento contable: Total Debe (${totalDebit.toFixed(2)}) no coincide con Total Haber (${totalCredit.toFixed(2)}). Diferencia: ${difference.toFixed(2)}`,
      );
    }
  }

  static isBalanced(entry: AccountingEntryEntity): boolean {
    if (entry.lines.length < 2) return false;
    const difference = Math.abs(entry.getTotalDebit() - entry.getTotalCredit());
    return difference <= 0.01;
  }
}
