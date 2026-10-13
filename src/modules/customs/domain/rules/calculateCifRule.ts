/**
 * Regla matemática del Valor CIF Aduana (Casilla 4 DAM).
 * CIF (USD) = FOB + Flete + Seguro
 * CIF (PEN) = CIF (USD) * TipoCambio
 */
export interface CifCalculationInput {
  fobUsd: number;
  freightUsd: number;
  insuranceUsd: number;
  exchangeRate: number;
}

export interface CifCalculationResult {
  cifUsd: number;
  cifPen: number;
}

export class CalculateCifRule {
  static execute(input: CifCalculationInput): CifCalculationResult {
    const { fobUsd, freightUsd, insuranceUsd, exchangeRate } = input;

    if (fobUsd <= 0) {
      throw new Error('El valor FOB debe ser estrictamente mayor a 0');
    }
    if (freightUsd < 0 || insuranceUsd < 0 || exchangeRate <= 0) {
      throw new Error('Los valores de flete, seguro y tipo de cambio no pueden ser negativos ni cero');
    }

    const cifUsd = Number((fobUsd + freightUsd + insuranceUsd).toFixed(2));
    const cifPen = Number((cifUsd * exchangeRate).toFixed(2));

    return { cifUsd, cifPen };
  }
}
