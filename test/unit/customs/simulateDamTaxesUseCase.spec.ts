import { SimulateDamTaxesUseCase } from '../../../src/modules/customs/application/use-cases/simulateDamTaxesUseCase';

describe('SimulateDamTaxesUseCase (Application Use Case)', () => {
  let useCase: SimulateDamTaxesUseCase;

  beforeEach(() => {
    useCase = new SimulateDamTaxesUseCase();
  });

  it('debe simular liquidación tributaria aduanera sin persistir en base de datos', async () => {
    const result = await useCase.execute({
      fobValueUsd: 10000,
      freightValueUsd: 1000,
      insuranceValueUsd: 100,
      exchangeRate: 3.8,
      adValoremRate: 0,
      perceptionRate: 3.5,
      items: [
        {
          hsCode: '8471.30.00.00',
          commercialDescription: 'Laptops de libre comercio',
          quantity: 20,
          fobUnitUsd: 500,
        },
      ],
    });

    expect(result.liquidation.cifUsd).toBe(11100);
    expect(result.liquidation.cifPen).toBe(42180);
    expect(result.hasRestrictedGoods).toBe(false);
  });

  it('debe detectar mercancías restringidas durante la simulación previa a la numeración', async () => {
    const result = await useCase.execute({
      fobValueUsd: 5000,
      freightValueUsd: 500,
      insuranceValueUsd: 50,
      exchangeRate: 3.8,
      adValoremRate: 6,
      items: [
        {
          hsCode: '8517.13.00.00',
          commercialDescription: 'Smartphones con radiofrecuencia',
          quantity: 10,
          fobUnitUsd: 500,
        },
      ],
    });

    expect(result.hasRestrictedGoods).toBe(true);
    expect(result.vuceWarnings).toHaveLength(1);
    expect(result.vuceWarnings[0].controllingEntity).toBe('MTC');
  });
});

