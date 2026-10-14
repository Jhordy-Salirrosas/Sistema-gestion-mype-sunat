/**
 * Regla matemática de liquidación de tributos aduaneros en Soles (PEN).
 * Ad-Valorem = CIF_PEN * (tasa / 100)
 * IGV/IPM (18%) = (CIF_PEN + Ad-Valorem) * 0.18
 * Percepción = (CIF_PEN + Total_Tributos) * (tasa / 100)
 */
export interface CustomsTaxesInput {
  cifPen: number;
  adValoremRate: number; // 0, 6 u 11
  perceptionRate: number; // 3.5, 5.0 o 10.0
}

export interface CustomsTaxesResult {
  adValoremAmountPen: number;
  igvIpmAmountPen: number;
  perceptionAmountPen: number;
  totalCustomsTaxesPen: number;
}

export class CalculateCustomsTaxesRule {
  static execute(input: CustomsTaxesInput): CustomsTaxesResult {
    const { cifPen, adValoremRate, perceptionRate } = input;

    // 1. Ad-Valorem
    const adValoremAmountPen = Number(
      (cifPen * (adValoremRate / 100)).toFixed(2),
    );

    // 2. IGV 16% + IPM 2% = 18% sobre (CIF + Ad-Valorem)
    const igvBase = cifPen + adValoremAmountPen;
    const igvIpmAmountPen = Number((igvBase * 0.18).toFixed(2));

    // 3. Percepción sobre (CIF + Tributos)
    const perceptionBase = cifPen + adValoremAmountPen + igvIpmAmountPen;
    const perceptionAmountPen = Number(
      (perceptionBase * (perceptionRate / 100)).toFixed(2),
    );

    // 4. Total tributos aduaneros a pagar
    const totalCustomsTaxesPen = Number(
      (adValoremAmountPen + igvIpmAmountPen + perceptionAmountPen).toFixed(2),
    );

    return {
      adValoremAmountPen,
      igvIpmAmountPen,
      perceptionAmountPen,
      totalCustomsTaxesPen,
    };
  }
}
