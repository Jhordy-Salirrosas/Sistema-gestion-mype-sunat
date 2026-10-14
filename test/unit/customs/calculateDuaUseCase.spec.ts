import { CalculateDuaUseCase } from '../../../src/modules/customs/application/use-cases/calculateDuaUseCase';

describe('CalculateDuaUseCase (Pruebas Unitarias)', () => {
  let useCase: CalculateDuaUseCase;

  beforeEach(() => {
    useCase = new CalculateDuaUseCase();
  });

  it('debe orquestar el cálculo de CIF y liquidación aduanera correctamente', () => {
    const result = useCase.execute({
      fob_value_usd: 10000.0,
      freight_value_usd: 1000.0,
      insurance_value_usd: 200.0,
      exchange_rate: 3.75,
      ad_valorem_rate: 6.0,
      perception_rate: 3.5,
    });

    // CIF_USD = 11,200.00
    // CIF_PEN = 11,200 * 3.75 = 42,000.00
    // Ad-Valorem (6%) = 2,520.00
    // IGV/IPM (18%) = (42,000 + 2,520) * 0.18 = 8,013.60
    // Percepción Base = 42,000 + 2,520 + 8,013.60 = 52,533.60 * 0.035 = 1,838.68
    // Total = 2,520 + 8,013.60 + 1,838.68 = 12,372.28
    expect(result.cif_value_usd).toBe(11200.0);
    expect(result.cif_value_pen).toBe(42000.0);
    expect(result.ad_valorem_amount_pen).toBe(2520.0);
    expect(result.igv_ipm_amount_pen).toBe(8013.6);
    expect(result.perception_amount_pen).toBe(1838.68);
    expect(result.total_customs_taxes_pen).toBe(12372.28);
  });
});
