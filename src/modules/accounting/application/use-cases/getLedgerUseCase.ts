import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';

@Injectable()
export class GetLedgerUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(companyId: string, period: string, accountCode: string) {
    const normalizado = /^\d{4}-\d{1,2}$/.test(period)
      ? `${period.slice(0, 4)}-${period.slice(5).padStart(2, '0')}`
      : period;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalizado)) {
      throw new BadRequestException('El período debe tener formato YYYY-MM');
    }
    if (!accountCode.trim()) {
      throw new BadRequestException('Selecciona una cuenta para el libro mayor');
    }

    const accounts = await this.repository.findAccounts();
    const account = accounts.find((item) => item.code === accountCode);
    if (!account) {
      throw new BadRequestException(`La cuenta PCGE ${accountCode} no existe`);
    }

    // El detalle de una cuenta de mayor vive en sus subcuentas. Si se pide el
    // mayor, se muestran todas sus hijas; si se pide una subcuenta, solo esa.
    const hijas = accounts
      .filter((item) => item.code !== accountCode && item.code.startsWith(accountCode))
      .map((item) => item.code);
    const codigos = [accountCode, ...hijas];
    const porVariasCuentas = hijas.length > 0 && this.repository.findLedgerMovementsByAccounts;

    const rows = porVariasCuentas
      ? await this.repository.findLedgerMovementsByAccounts!(companyId, normalizado, codigos)
      : await this.repository.findLedgerMovements(companyId, normalizado, accountCode);

    const factor = account.nature === 'Acreedora' ? -1 : 1;
    const saldoInicial = porVariasCuentas && this.repository.findLedgerOpeningBalanceByAccounts
      ? await this.repository.findLedgerOpeningBalanceByAccounts(companyId, normalizado, codigos)
      : (await this.repository.findLedgerOpeningBalance?.(companyId, normalizado, accountCode)) ?? 0;
    const openingBalance = Math.round(factor * saldoInicial * 100) / 100;
    let saldo = openingBalance;
    const movements = rows.map((row) => {
      saldo = Math.round((saldo + factor * (row.debit - row.credit)) * 100) / 100;
      return {
        ...row,
        entryDate: row.entryDate.toISOString().slice(0, 10),
        saldo,
      };
    });
    const totalDebit = Math.round(rows.reduce((sum, row) => sum + row.debit, 0) * 100) / 100;
    const totalCredit = Math.round(rows.reduce((sum, row) => sum + row.credit, 0) * 100) / 100;

    return {
      period: normalizado,
      accountCode: account.code,
      accountName: account.name,
      nature: account.nature,
      openingBalance,
      movements,
      totalDebit,
      totalCredit,
      // El saldo final incluye el de apertura: antes se calculaba solo con el
      // movimiento del período y una cuenta con arrastre cerraba mal.
      closingBalance: movements.length > 0 ? movements[movements.length - 1].saldo : openingBalance,
      /** Subcuentas incluidas en el mayor cuando se pide una cuenta de mayor. */
      subcuentas: codigos,
    };
  }
}
