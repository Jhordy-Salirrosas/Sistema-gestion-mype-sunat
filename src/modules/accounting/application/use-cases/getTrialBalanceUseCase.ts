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
    const normalizado = /^\d{4}-\d{1,2}$/.test(period)
      ? `${period.slice(0, 4)}-${period.slice(5).padStart(2, '0')}`
      : period;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalizado)) {
      throw new BadRequestException('El período debe tener formato YYYY-MM');
    }

    const rows = await this.repository.findTrialBalanceRows(companyId, normalizado);
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

    return { period: normalizado, rows: data, totalDebit, totalCredit };
  }
}
