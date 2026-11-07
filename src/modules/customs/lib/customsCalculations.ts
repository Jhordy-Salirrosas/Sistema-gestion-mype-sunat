import {
  type CalculateDuaPayload,
  type CustomsItem,
  type DuaCalculationResult,
} from '../types/customs.types';

export const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const round4 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
};

/**
 * Calcula en tiempo real los tributos aduaneros y el costo Landed Cost según NIC 2 y SUNAT.
 */
export const calculateCustomsTaxes = (
  input: Partial<CalculateDuaPayload>
): DuaCalculationResult => {
  const fob = Math.max(0, Number(input.fob_value_usd) || 0);
  const freight = Math.max(0, Number(input.freight_value_usd) || 0);
  const insurance = Math.max(0, Number(input.insurance_value_usd) || 0);
  const tc = Math.max(0, Number(input.exchange_rate) || 1);
  const adValoremRate = Math.max(0, Number(input.ad_valorem_rate) || 0);
  const perceptionRate = Math.max(0, Number(input.perception_rate) || 0);

  // 1. CIF en Dólares y Soles
  const cifUsd = round2(fob + freight + insurance);
  const cifPen = round2(cifUsd * tc);

  // 2. Arancel Ad-Valorem
  const adValoremPen = round2(cifPen * (adValoremRate / 100));

  // 3. IGV (16%) + IPM (2%)
  const baseIgvIpmPen = round2(cifPen + adValoremPen);
  const igvIpmPen = round2(baseIgvIpmPen * 0.18);

  // 4. Percepción del IGV
  const basePerceptionPen = round2(cifPen + adValoremPen + igvIpmPen);
  const perceptionPen = round2(basePerceptionPen * (perceptionRate / 100));

  // 5. Total de Tributos a Pagar
  const totalTaxesPen = round2(adValoremPen + igvIpmPen + perceptionPen);

  // 6. Costo Total que entra al Kardex (NIC 2: CIF + Ad-Valorem)
  const landedCostTotalPen = round2(cifPen + adValoremPen);

  // 7. Crédito Fiscal Recuperable (IGV + IPM + Percepción)
  const fiscalCreditPen = round2(igvIpmPen + perceptionPen);

  return {
    cif_value_usd: cifUsd,
    cif_value_pen: cifPen,
    ad_valorem_amount_pen: adValoremPen,
    igv_ipm_amount_pen: igvIpmPen,
    perception_amount_pen: perceptionPen,
    total_customs_taxes_pen: totalTaxesPen,
    landed_cost_total_pen: landedCostTotalPen,
    fiscal_credit_pen: fiscalCreditPen,
  };
};

/**
 * Prorratea el Landed Cost unitario de cada producto de acuerdo al peso de su valor FOB.
 */
export const calculateItemProrating = (
  items: CustomsItem[],
  totalFobUsd: number,
  cifPen: number,
  adValoremPen: number
): CustomsItem[] => {
  if (totalFobUsd <= 0 || items.length === 0) return items;

  return items.map((item) => {
    const itemFobTotal = round2(item.quantity * item.fob_unit_usd);
    const factorFob = round4(itemFobTotal / totalFobUsd);

    const allocatedCifPen = round2(cifPen * factorFob);
    const allocatedDutiesPen = round2(adValoremPen * factorFob);
    const totalItemLandedPen = round2(allocatedCifPen + allocatedDutiesPen);
    const landedCostUnitPen = item.quantity > 0 ? round4(totalItemLandedPen / item.quantity) : 0;

    return {
      ...item,
      fob_total_usd: itemFobTotal,
      allocated_cif_pen: allocatedCifPen,
      allocated_duties_pen: allocatedDutiesPen,
      landed_cost_unit_pen: landedCostUnitPen,
    };
  });
};
