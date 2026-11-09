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

    const rows = await this.repository.findLedgerMovements(companyId, normalizado, accountCode);
    const factor = account.nature === 'Acreedora' ? -1 : 1;
    const openingBalance = Math.round(factor * ((await this.repository.findLedgerOpeningBalance?.(companyId, normalizado, accountCode)) ?? 0) * 100) / 100;
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
      closingBalance: Math.round(factor * (totalDebit - totalCredit) * 100) / 100,
    };
  }
}
