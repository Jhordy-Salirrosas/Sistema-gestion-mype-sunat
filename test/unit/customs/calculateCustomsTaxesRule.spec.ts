import { CalculateCustomsTaxesRule } from '../../../src/modules/customs/domain/rules/calculateCustomsTaxesRule';

describe('CalculateCustomsTaxesRule (Pruebas Unitarias)', () => {
  it('debe liquidar Ad-Valorem 6%, IGV/IPM 18% y Percepción 3.5% correctamente', () => {
    // Supongamos CIF_PEN = 10,000.00
    // Ad-Valorem (6%) = 600.00
    // IGV Base = 10,600.00 * 0.18 = 1,908.00
    // Percepción Base = 10,000 + 600 + 1,908 = 12,508.00 * 0.035 = 437.78
    // Total Tributos = 600 + 1908 + 437.78 = 2,945.78
    const taxes = CalculateCustomsTaxesRule.execute({
      cifPen: 10000.0,
      adValoremRate: 6.0,
      perceptionRate: 3.5,
    });

    expect(taxes.adValoremAmountPen).toBe(600.0);
    expect(taxes.igvIpmAmountPen).toBe(1908.0);
    expect(taxes.perceptionAmountPen).toBe(437.78);
    expect(taxes.totalCustomsTaxesPen).toBe(2945.78);
  });

  it('debe liquidar con Ad-Valorem 0% si la mercancía está liberada de arancel', () => {
    const taxes = CalculateCustomsTaxesRule.execute({
      cifPen: 10000.0,
      adValoremRate: 0.0,
      perceptionRate: 3.5,
    });

    expect(taxes.adValoremAmountPen).toBe(0.0);
    expect(taxes.igvIpmAmountPen).toBe(1800.0); // 10000 * 0.18
  });
});
