import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type {
  IncomeStatementGroup,
} from '../../domain/entities/incomeStatementEntity';

const GRUPOS = [
  { key: 'ingresos' as const, label: 'Ingresos', prefijos: ['70'], signo: -1 },
  { key: 'costoVentas' as const, label: 'Costo de ventas', prefijos: ['69'], signo: 1 },
  {
    key: 'gastosOperativos' as const,
    label: 'Gastos operativos',
    prefijos: ['63', '64', '65', '68', '94', '95', '96', '97'],
    signo: 1,
  },
];

@Injectable()
export class GetIncomeStatementUseCase {
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
    const groups: IncomeStatementGroup[] = GRUPOS.map((grupo) => {
      const lines = rows
        .filter((row) => grupo.prefijos.some((prefijo) => row.accountCode.startsWith(prefijo)))
        .map((row) => ({
          accountCode: row.accountCode,
          accountName: row.accountName,
          amount: Math.round(grupo.signo * (row.debit - row.credit) * 100) / 100,
        }))
        .filter((line) => line.amount !== 0);
      return {
        key: grupo.key,
        label: grupo.label,
        lines,
        total: Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
      };
    });

    const ingresos = groups.find((g) => g.key === 'ingresos')?.total ?? 0;
    const costoVentas = groups.find((g) => g.key === 'costoVentas')?.total ?? 0;
    const gastosOperativos = groups.find((g) => g.key === 'gastosOperativos')?.total ?? 0;
    const resultadoBruto = Math.round((ingresos - costoVentas) * 100) / 100;
    const resultadoOperativo = Math.round((resultadoBruto - gastosOperativos) * 100) / 100;

    return {
      period: normalizado,
      groups,
      ingresos,
      costoVentas,
      gastosOperativos,
      resultadoBruto,
      resultadoOperativo,
    };
  }
}
