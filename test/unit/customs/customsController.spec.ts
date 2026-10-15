import { CustomsController } from '../../../src/modules/customs/infrastructure/controllers/customsController';
import { CalculateDuaUseCase } from '../../../src/modules/customs/application/use-cases/calculateDuaUseCase';
import { CalculateDuaDto } from '../../../src/modules/customs/application/dto/calculateDuaDto';

describe('CustomsController', () => {
  let controller: CustomsController;
  let calculateDuaUseCase: jest.Mocked<CalculateDuaUseCase>;

  beforeEach(() => {
    calculateDuaUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CalculateDuaUseCase>;

    controller = new CustomsController(calculateDuaUseCase);
  });

  it('debe delegar el cálculo de liquidación DUA al caso de uso', () => {
    const mockResponse = {
      cif_value_usd: 12000,
      cif_value_pen: 45600,
      ad_valorem_amount_pen: 2736,
      igv_ipm_amount_pen: 8700.48,
      perception_amount_pen: 1996.18,
      total_customs_taxes_pen: 13432.66,
    };

    calculateDuaUseCase.execute.mockReturnValue(mockResponse);

    const dto: CalculateDuaDto = {
      fob_value_usd: 10000,
      freight_value_usd: 1500,
      insurance_value_usd: 500,
      exchange_rate: 3.8,
      ad_valorem_rate: 6,
      perception_rate: 3.5,
    };

    const result = controller.calculateLiquidation(dto);

    expect(result).toEqual(mockResponse);
    expect(calculateDuaUseCase.execute).toHaveBeenCalledWith(dto);
  });
});
