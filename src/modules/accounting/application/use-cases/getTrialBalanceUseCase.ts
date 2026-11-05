import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';

@Injectable()
export class GetTrialBalanceUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(companyId: string, period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('El período debe tener formato YYYY-MM');
    }

    const rows = await this.repository.findTrialBalanceRows(companyId, period);
    const data = rows.map((row) => {
      const debit = Math.round(row.debit * 100) / 100;
      const credit = Math.round(row.credit * 100) / 100;
      return {
        ...row,
        debit,
        credit,
        balance: Math.round((debit - credit) * 100) / 100,
      };
    });
    const totalDebit = Math.round(data.reduce((sum, row) => sum + row.debit, 0) * 100) / 100;
    const totalCredit = Math.round(data.reduce((sum, row) => sum + row.credit, 0) * 100) / 100;

    return { period, rows: data, totalDebit, totalCredit };
  }
}
