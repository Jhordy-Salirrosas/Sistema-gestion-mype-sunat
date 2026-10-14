import { CalculateCifRule } from '../../../src/modules/customs/domain/rules/calculateCifRule';

describe('CalculateCifRule (Pruebas Unitarias)', () => {
  it('debe calcular CIF USD y CIF PEN correctamente', () => {
    const result = CalculateCifRule.execute({
      fobUsd: 10000.0,
      freightUsd: 1200.0,
      insuranceUsd: 300.0,
      exchangeRate: 3.755,
    });

    expect(result.cifUsd).toBe(11500.0);
    expect(result.cifPen).toBe(43182.5); // 11500 * 3.755
  });

  it('debe lanzar excepción si FOB es menor o igual a cero', () => {
    expect(() =>
      CalculateCifRule.execute({
        fobUsd: 0,
        freightUsd: 100,
        insuranceUsd: 50,
        exchangeRate: 3.75,
      }),
    ).toThrow('FOB debe ser estrictamente mayor a 0');
  });
});
