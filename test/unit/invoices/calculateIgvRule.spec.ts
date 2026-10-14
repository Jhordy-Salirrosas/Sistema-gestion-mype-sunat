import { CalculateIgvRule } from '../../../src/modules/invoices/domain/rules/calculateIgvRule';

describe('CalculateIgvRule', () => {
  it('calcula la base imponible y el 18% de IGV correctamente', () => {
    const result = CalculateIgvRule.execute({ montoTotal: 118 });

    expect(result.baseImponible).toBe(100);
    expect(result.montoIgv).toBe(18);
    expect(result.montoTotal).toBe(118);
  });

  it('maneja montos con decimales redondeando a dos decimales', () => {
    const result = CalculateIgvRule.execute({ montoTotal: 150.5 });

    // 150.5 / 1.18 = 127.5423... -> 127.54
    // 150.5 - 127.54 = 22.96
    expect(result.baseImponible).toBe(127.54);
    expect(result.montoIgv).toBe(22.96);
    expect(result.montoTotal).toBe(150.5);
  });
});
