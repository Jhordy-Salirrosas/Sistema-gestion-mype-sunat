import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';

export interface ClosingPreview {
  year: number;
  totalIngresos: number;
  totalGastos: number;
  resultado: number;
  /** Utilidad o pérdida, en palabras. */
  tipo: 'UTILIDAD' | 'PÉRDIDA' | 'SIN RESULTADO';
  lineas: Array<{ accountCode: string; accountName: string; debitAmount: number; creditAmount: number }>;
  tieneAsientoCierre: boolean;
}

/**
 * Vista previa del asiento de cierre del ejercicio.
 *
 * Suma las cuentas de ingresos (7) y de gastos (6) del año para mostrar el
 * resultado ANTES de generar nada: el asiento de cierre es irreversible desde la
 * pantalla y no debe descubrirse después de grabarlo.
 */
@Injectable()
export class GetClosingPreviewUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(companyId: string, year: number): Promise<ClosingPreview> {
    const totales = await this.repository.saldosDeResultado(companyId, year);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const lineas: ClosingPreview['lineas'] = [];
    let totalIngresos = 0;
    let totalGastos = 0;

    for (const cuenta of totales) {
      const esIngreso = cuenta.code.startsWith('7');
      const esGasto = cuenta.code.startsWith('6');
      if (!esIngreso && !esGasto) continue;
      const saldo = r2(cuenta.credit - cuenta.debit);
      if (esIngreso && saldo > 0) {
        totalIngresos += saldo;
        lineas.push({ accountCode: cuenta.code, accountName: cuenta.name, debitAmount: saldo, creditAmount: 0 });
      }
      if (esGasto && -saldo > 0) {
        totalGastos += -saldo;
        lineas.push({ accountCode: cuenta.code, accountName: cuenta.name, debitAmount: 0, creditAmount: -saldo });
      }
    }

    const resultado = r2(totalIngresos - totalGastos);
    const tieneAsientoCierre = await this.repository.existsBySourceReference(
      companyId,
      'CLOSING',
      `CIERRE-${year}`,
    );

    return {
      year,
      totalIngresos: r2(totalIngresos),
      totalGastos: r2(totalGastos),
      resultado,
      tipo: resultado > 0 ? 'UTILIDAD' : resultado < 0 ? 'PÉRDIDA' : 'SIN RESULTADO',
      lineas,
      tieneAsientoCierre,
    };
  }
}
