import { UnauthorizedException } from '@nestjs/common';
import { CustomsController } from '../../../src/modules/customs/infrastructure/controllers/customsController';
import { CalculateDuaUseCase } from '../../../src/modules/customs/application/use-cases/calculateDuaUseCase';
import { RegisterDuaUseCase } from '../../../src/modules/customs/application/use-cases/registerDuaUseCase';
import { GetCustomsDeclarationByIdUseCase } from '../../../src/modules/customs/application/use-cases/getCustomsDeclarationByIdUseCase';
import { ListCustomsDeclarationsUseCase } from '../../../src/modules/customs/application/use-cases/listCustomsDeclarationsUseCase';
import { CalculateDuaDto } from '../../../src/modules/customs/application/dto/calculateDuaDto';
import { RegisterDuaDto } from '../../../src/modules/customs/application/dto/registerDuaDto';

describe('CustomsController', () => {
  let controller: CustomsController;
  let calculateDuaUseCase: jest.Mocked<CalculateDuaUseCase>;
  let registerDuaUseCase: jest.Mocked<RegisterDuaUseCase>;
  let getCustomsDeclarationByIdUseCase: jest.Mocked<GetCustomsDeclarationByIdUseCase>;
  let listCustomsDeclarationsUseCase: jest.Mocked<ListCustomsDeclarationsUseCase>;

  beforeEach(() => {
    calculateDuaUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CalculateDuaUseCase>;

    registerDuaUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RegisterDuaUseCase>;

    getCustomsDeclarationByIdUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetCustomsDeclarationByIdUseCase>;

    listCustomsDeclarationsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListCustomsDeclarationsUseCase>;

    controller = new CustomsController(
      calculateDuaUseCase,
      registerDuaUseCase,
      getCustomsDeclarationByIdUseCase,
      listCustomsDeclarationsUseCase,
    );
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
      ad_valorem_rate: 6.0,
      perception_rate: 3.5,
    };

    const result = controller.calculateLiquidation(dto);
    expect(result).toEqual(mockResponse);
    expect(calculateDuaUseCase.execute).toHaveBeenCalledWith(dto);
  });

  it('debe registrar una DUA y delegar al caso de uso con el companyId verificado', async () => {
    const mockResponse = {
      id: 'dua-123',
      dua_number: '118-2026-10-001234',
      customs_agency_code: '118',
      regime_code: '10',
      numeration_date: new Date('2026-10-15'),
      cif_value_usd: 12000,
      cif_value_pen: 45600,
      total_customs_taxes_pen: 13432.66,
      status: 'LIQUIDADO',
      items_count: 1,
      created_at: new Date(),
    };

    registerDuaUseCase.execute.mockResolvedValue(mockResponse);

    const dto: RegisterDuaDto = {
      dua_number: '118-2026-10-001234',
      customs_agency_code: '118',
      regime_code: '10',
      numeration_date: '2026-10-15',
      fob_value_usd: 10000,
      freight_value_usd: 1500,
      insurance_value_usd: 500,
      exchange_rate: 3.8,
      ad_valorem_rate: 6.0,
      perception_rate: 3.5,
      items: [
        {
          item_order: 1,
          hs_code: '8471300000',
          commercial_description: 'Laptop',
          quantity: 10,
          unit_code: 'NIU',
          fob_unit_usd: 1000,
        },
      ],
    };

    const result = await controller.registerDeclaration('comp-001', dto);
    expect(result).toEqual(mockResponse);
    expect(registerDuaUseCase.execute).toHaveBeenCalledWith(dto, 'comp-001');
  });

  it('debe arrojar UnauthorizedException si no se provee companyId al registrar DUA', async () => {
    const dto: RegisterDuaDto = {
      dua_number: '118-2026-10-001234',
      customs_agency_code: '118',
      numeration_date: '2026-10-15',
      fob_value_usd: 10000,
      freight_value_usd: 1500,
      insurance_value_usd: 500,
      exchange_rate: 3.8,
      ad_valorem_rate: 6.0,
      perception_rate: 3.5,
      items: [],
    };

    await expect(controller.registerDeclaration(undefined, dto)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe obtener el detalle de una DAM por id', async () => {
    const mockDetail = {
      id: 'dua-123',
      dua_number: '118-2026-10-001234',
      customs_agency_code: '118',
      regime_code: '10',
      numeration_date: new Date('2026-10-15'),
      fob_value_usd: 10000,
      freight_value_usd: 1500,
      insurance_value_usd: 500,
      cif_value_usd: 12000,
      exchange_rate: 3.8,
      cif_value_pen: 45600,
      ad_valorem_rate: 6.0,
      ad_valorem_amount_pen: 2736,
      igv_rate: 16.0,
      ipm_rate: 2.0,
      igv_ipm_amount_pen: 8700.48,
      perception_rate: 3.5,
      perception_amount_pen: 1996.18,
      total_customs_taxes_pen: 13432.66,
      status: 'LIQUIDADO',
      items: [],
      created_at: new Date(),
    };

    getCustomsDeclarationByIdUseCase.execute.mockResolvedValue(mockDetail);

    const result = await controller.getDeclarationById('dua-123', 'comp-001');
    expect(result).toEqual(mockDetail);
    expect(getCustomsDeclarationByIdUseCase.execute).toHaveBeenCalledWith('dua-123', 'comp-001');
  });

  it('debe listar declaraciones por empresa', async () => {
    const mockList = [
      {
        id: 'dua-1',
        duaNumber: '118-2026-10-000001',
        customsAgencyCode: '118',
        numerationDate: new Date('2026-10-01'),
        cifValueUsd: 5000,
        cifValuePen: 19000,
        totalCustomsTaxesPen: 5500,
        status: 'LIQUIDADO',
        itemsCount: 2,
        createdAt: new Date(),
      },
    ];

    listCustomsDeclarationsUseCase.execute.mockResolvedValue(mockList);

    const result = await controller.listDeclarations('comp-001');
    expect(result).toEqual(mockList);
    expect(listCustomsDeclarationsUseCase.execute).toHaveBeenCalledWith('comp-001');
  });
});
