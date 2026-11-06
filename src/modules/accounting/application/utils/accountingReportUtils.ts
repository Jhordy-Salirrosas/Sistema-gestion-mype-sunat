import { BadRequestException } from '@nestjs/common';
import type { TrialBalanceRow } from '../../domain/entities/accountingReportEntity';

export interface GrupoConfig<K extends string> {
  key: K;
  label: string;
  prefijos: readonly string[];
  signo: number;
}

export interface GrupoCalculado<K extends string> {
  key: K;
  label: string;
  lines: Array<{ accountCode: string; accountName: string; amount: number }>;
  total: number;
}

export function validarPeriodo(period: string): string {
  const normalizado = /^\d{4}-\d{1,2}$/.test(period)
    ? `${period.slice(0, 4)}-${period.slice(5).padStart(2, '0')}`
    : period;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalizado)) {
    throw new BadRequestException('El período debe tener formato YYYY-MM');
  }
  return normalizado;
}

export function agruparSaldos<K extends string>(
  rows: readonly TrialBalanceRow[],
  configs: readonly GrupoConfig<K>[],
): Array<GrupoCalculado<K>> {
  return configs.map((grupo) => {
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
}

export function resultadoDelEjercicio(rows: readonly TrialBalanceRow[]): number {
  const ingreso = rows
    .filter((row) => row.accountCode.startsWith('70'))
    .reduce((sum, row) => sum + (row.credit - row.debit), 0);
  const gasto = rows
    .filter((row) => /^(69|6|9)/.test(row.accountCode))
    .reduce((sum, row) => sum + (row.debit - row.credit), 0);
  return Math.round((ingreso - gasto) * 100) / 100;
}
