export interface IgvCalculationInput {
  montoTotal: number;
  tasaIgv?: number; // Por defecto 0.18 (18%)
}

export interface IgvCalculationResult {
  baseImponible: number;
  montoIgv: number;
  montoTotal: number;
}

export class CalculateIgvRule {
  private static readonly DEFAULT_IGV_RATE = 0.18;

  static execute(input: IgvCalculationInput): IgvCalculationResult {
    const rate = input.tasaIgv ?? this.DEFAULT_IGV_RATE;
    const base = Number((input.montoTotal / (1 + rate)).toFixed(2));
    const igv = Number((input.montoTotal - base).toFixed(2));

    return {
      baseImponible: base,
      montoIgv: igv,
      montoTotal: input.montoTotal,
    };
  }
}
