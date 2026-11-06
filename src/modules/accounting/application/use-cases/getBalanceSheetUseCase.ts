import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { BalanceSheetGroup } from '../../domain/entities/balanceSheetEntity';
import { agruparSaldos, resultadoDelEjercicio, validarPeriodo } from '../utils/accountingReportUtils';

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
    const normalizado = validarPeriodo(period);
    const rows = await this.repository.findTrialBalanceRows(companyId, normalizado);
    const groups = agruparSaldos(rows, GRUPOS) as BalanceSheetGroup[];
    const resultadoEjercicio = resultadoDelEjercicio(rows);

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
