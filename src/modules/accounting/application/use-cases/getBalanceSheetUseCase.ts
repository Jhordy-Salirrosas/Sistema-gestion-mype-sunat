import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { BalanceSheetGroup } from '../../domain/entities/balanceSheetEntity';

const GRUPOS = [
  { key: 'activo' as const, label: 'Activo', prefijos: ['1', '2', '3'], signo: 1 },
  { key: 'pasivo' as const, label: 'Pasivo', prefijos: ['4'], signo: -1 },
  { key: 'patrimonio' as const, label: 'Patrimonio', prefijos: ['5'], signo: -1 },
];

@Injectable()
export class GetBalanceSheetUseCase {
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
    const groups: BalanceSheetGroup[] = GRUPOS.map((grupo) => {
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

    const ingreso = rows
      .filter((row) => row.accountCode.startsWith('70'))
      .reduce((sum, row) => sum + (row.credit - row.debit), 0);
    const gasto = rows
      .filter((row) => /^(69|6|9)/.test(row.accountCode))
      .reduce((sum, row) => sum + (row.debit - row.credit), 0);
    const resultadoEjercicio = Math.round((ingreso - gasto) * 100) / 100;

    const activo = groups.find((g) => g.key === 'activo')!;
    const pasivo = groups.find((g) => g.key === 'pasivo')!;
    const patrimonio = groups.find((g) => g.key === 'patrimonio')!;
    const totalPatrimonio = Math.round((patrimonio.total + resultadoEjercicio) * 100) / 100;
    const totalPasivoPatrimonio = Math.round((pasivo.total + totalPatrimonio) * 100) / 100;

    return {
      period: normalizado,
      activo,
      pasivo,
      patrimonio,
      resultadoEjercicio,
      totalActivo: activo.total,
      totalPatrimonio,
      totalPasivoPatrimonio,
      cuadra: Math.abs(activo.total - totalPasivoPatrimonio) < 0.01,
    };
  }
}
