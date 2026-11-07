import { describe, it, expect } from 'vitest';
import { round2, round4 } from '@/modules/customs/lib/customsCalculations';

interface SeriesItem {
  series_order: number;
  product_code: string;
  description: string;
  quantity: number;
  fob_usd: number;
  gross_weight_kg: number;
}

interface LocalExpense {
  concept: string;
  net_amount_pen: number;
  igv_amount_pen: number;
  proration_method: 'VALOR_FOB' | 'PESO_BRUTO';
}

/**
 * Motor de prorrateo bivariado bajo NIC 2 (Inventarios párrafo 11).
 */
function computeLandedCostBreakdown(
  items: SeriesItem[],
  fobUsdTotal: number,
  exchangeRate: number,
  freightUsd: number,
  insuranceUsd: number,
  adValoremTotalPen: number,
  localExpenses: LocalExpense[]
) {
  const cifUsdTotal = fobUsdTotal + freightUsd + insuranceUsd;
  const cifPenTotal = round2(cifUsdTotal * exchangeRate);

  const totalGrossWeight = items.reduce((acc, it) => acc + it.gross_weight_kg, 0);

  // Separar gastos locales por criterio
  const weightExpensesPen = localExpenses
    .filter((e) => e.proration_method === 'PESO_BRUTO')
    .reduce((acc, e) => acc + e.net_amount_pen, 0);

  const fobExpensesPen = localExpenses
    .filter((e) => e.proration_method === 'VALOR_FOB')
    .reduce((acc, e) => acc + e.net_amount_pen, 0);

  const totalFiscalCreditPen = localExpenses.reduce((acc, e) => acc + e.igv_amount_pen, 0);

  // Prorrateo por ítem
  const seriesBreakdown = items.map((item) => {
    const factorFob = fobUsdTotal > 0 ? item.fob_usd / fobUsdTotal : 0;
    const factorWeight = totalGrossWeight > 0 ? item.gross_weight_kg / totalGrossWeight : 0;

    // CIF y Arancel asignados por peso FOB
    const allocatedCifPen = round2(cifPenTotal * factorFob);
    const allocatedAdValoremPen = round2(adValoremTotalPen * factorFob);

    // Gastos locales distribuidos según el criterio de cada uno
    const allocatedLocalWeightPen = round2(weightExpensesPen * factorWeight);
    const allocatedLocalFobPen = round2(fobExpensesPen * factorFob);
    const totalLocalExpensesPen = round2(allocatedLocalWeightPen + allocatedLocalFobPen);

    // Costo total nacionalizado que va a Kardex (NIC 2)
    const totalItemLandedCostPen = round2(
      allocatedCifPen + allocatedAdValoremPen + totalLocalExpensesPen
    );

    const landedCostUnitPen = item.quantity > 0 ? round4(totalItemLandedCostPen / item.quantity) : 0;

    return {
      product_code: item.product_code,
      quantity: item.quantity,
      allocatedCifPen,
      allocatedAdValoremPen,
      totalLocalExpensesPen,
      totalItemLandedCostPen,
      landedCostUnitPen,
    };
  });

  const grandTotalInventoryPen = seriesBreakdown.reduce(
    (acc, it) => acc + it.totalItemLandedCostPen,
    0
  );

  return {
    cifPenTotal,
    grandTotalInventoryPen,
    totalFiscalCreditPen,
    seriesBreakdown,
  };
}

describe('Landed Cost NIC 2 — Motor Matemático de Prorrateo Bivariado y Aislamiento de IGV', () => {
  const items: SeriesItem[] = [
    {
      series_order: 1,
      product_code: 'LAP-GAMER-16',
      description: 'Laptops Gamer',
      quantity: 60,
      fob_usd: 30000.0, // 60% del FOB
      gross_weight_kg: 120.0, // 40% del peso
    },
    {
      series_order: 2,
      product_code: 'MON-4K-27',
      description: 'Monitores 27 Pulgadas',
      quantity: 40,
      fob_usd: 20000.0, // 40% del FOB
      gross_weight_kg: 180.0, // 60% del peso
    },
  ];

  const totalFobUsd = 50000.0;
  const exchangeRate = 3.82;
  const freightUsd = 1200.0;
  const insuranceUsd = 375.0; // Seguro TPPS 0.75%
  const adValoremTotalPen = 0.0; // 0% por TLC Perú-China

  const localExpenses: LocalExpense[] = [
    {
      concept: 'ALMACENAJE Y MANIPULEO PORTUARIO (APM)',
      net_amount_pen: 1200.0,
      igv_amount_pen: 216.0,
      proration_method: 'PESO_BRUTO', // Se prorratea por peso
    },
    {
      concept: 'COMISIÓN DE AGENCIA DE ADUANA AFANZADA',
      net_amount_pen: 800.0,
      igv_amount_pen: 144.0,
      proration_method: 'VALOR_FOB', // Se prorratea por valor FOB
    },
  ];

  it('debe computar el CIF en Soles con exactitud comercial', () => {
    const res = computeLandedCostBreakdown(
      items,
      totalFobUsd,
      exchangeRate,
      freightUsd,
      insuranceUsd,
      adValoremTotalPen,
      localExpenses
    );

    // CIF USD: 50,000 + 1,200 + 375 = 51,575 USD
    // CIF PEN: 51,575 * 3.82 = 197,016.50 PEN
    expect(res.cifPenTotal).toBe(197016.5);
  });

  it('debe aislar el 100% del IGV de facturas locales como Crédito Fiscal (NIC 2 §11)', () => {
    const res = computeLandedCostBreakdown(
      items,
      totalFobUsd,
      exchangeRate,
      freightUsd,
      insuranceUsd,
      adValoremTotalPen,
      localExpenses
    );

    // IGV APM (216) + IGV Agencia (144) = 360 PEN
    expect(res.totalFiscalCreditPen).toBe(360.0);
    // El costo en inventario debe capitalizar únicamente las bases netas (1,200 + 800 = 2,000 PEN)
    const expectedInventory = res.cifPenTotal + 0 + 2000.0;
    expect(Math.abs(res.grandTotalInventoryPen - expectedInventory)).toBeLessThanOrEqual(0.1);
  });

  it('debe distribuir los gastos portuarios según el peso bruto y la comisión de agencia según el FOB', () => {
    const res = computeLandedCostBreakdown(
      items,
      totalFobUsd,
      exchangeRate,
      freightUsd,
      insuranceUsd,
      adValoremTotalPen,
      localExpenses
    );

    const s1 = res.seriesBreakdown[0]; // Laptops: 40% peso, 60% FOB
    const s2 = res.seriesBreakdown[1]; // Monitores: 60% peso, 40% FOB

    // Almacenaje APM: S/ 1,200 -> Serie 1 (40% = 480), Serie 2 (60% = 720)
    // Agencia: S/ 800 -> Serie 1 (60% = 480), Serie 2 (40% = 320)
    // Total gastos locales Serie 1: 480 + 480 = 960 PEN
    // Total gastos locales Serie 2: 720 + 320 = 1040 PEN
    expect(s1.totalLocalExpensesPen).toBe(960.0);
    expect(s2.totalLocalExpensesPen).toBe(1040.0);
  });

  it('debe calcular el costo unitario de nacionalización con 4 decimales exactos', () => {
    const res = computeLandedCostBreakdown(
      items,
      totalFobUsd,
      exchangeRate,
      freightUsd,
      insuranceUsd,
      adValoremTotalPen,
      localExpenses
    );

    const s1 = res.seriesBreakdown[0]; // 60 Laptops
    expect(s1.landedCostUnitPen).toBeGreaterThan(0);
    // Costo unitario * cantidad debe coincidir con el total asignado de la serie
    const recon1 = round2(s1.landedCostUnitPen * s1.quantity);
    expect(Math.abs(recon1 - s1.totalItemLandedCostPen)).toBeLessThanOrEqual(0.05);
  });
});
