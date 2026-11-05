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
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
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

    const rows = await this.repository.findLedgerMovements(companyId, period, accountCode);
    let saldo = 0;
    const movements = rows.map((row) => {
      saldo = Math.round((saldo + row.debit - row.credit) * 100) / 100;
      return {
        ...row,
        entryDate: row.entryDate.toISOString().slice(0, 10),
        saldo,
      };
    });
    const totalDebit = Math.round(rows.reduce((sum, row) => sum + row.debit, 0) * 100) / 100;
    const totalCredit = Math.round(rows.reduce((sum, row) => sum + row.credit, 0) * 100) / 100;

    return {
      period,
      accountCode: account.code,
      accountName: account.name,
      nature: account.nature,
      openingBalance: 0,
      movements,
      totalDebit,
      totalCredit,
      closingBalance: Math.round((totalDebit - totalCredit) * 100) / 100,
    };
  }
}
