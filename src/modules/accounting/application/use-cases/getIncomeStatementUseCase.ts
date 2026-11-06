import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type {
  IncomeStatementGroup,
} from '../../domain/entities/incomeStatementEntity';
import { agruparSaldos, resultadoDelEjercicio, validarPeriodo } from '../utils/accountingReportUtils';

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
    const normalizado = validarPeriodo(period);
    const rows = await this.repository.findTrialBalanceRows(companyId, normalizado);
    const groups = agruparSaldos(rows, GRUPOS) as IncomeStatementGroup[];
    const resultado = resultadoDelEjercicio(rows);
    const ingresos = groups.find((g) => g.key === 'ingresos')?.total ?? 0;
    const costoVentas = groups.find((g) => g.key === 'costoVentas')?.total ?? 0;
    const gastosOperativos = groups.find((g) => g.key === 'gastosOperativos')?.total ?? 0;

    return {
      period: normalizado,
      groups,
      ingresos,
      costoVentas,
      gastosOperativos,
      resultadoBruto: Math.round((ingresos - costoVentas) * 100) / 100,
      resultadoOperativo: resultado,
    };
  }
}
