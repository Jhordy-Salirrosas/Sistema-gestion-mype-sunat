import { CustomsController } from '../../../src/modules/customs/infrastructure/controllers/customsController';
import { CalculateDuaUseCase } from '../../../src/modules/customs/application/use-cases/calculateDuaUseCase';
import { RegisterDuaUseCase } from '../../../src/modules/customs/application/use-cases/registerDuaUseCase';
import { GetCustomsDeclarationByIdUseCase } from '../../../src/modules/customs/application/use-cases/getCustomsDeclarationByIdUseCase';
import { ListCustomsDeclarationsUseCase } from '../../../src/modules/customs/application/use-cases/listCustomsDeclarationsUseCase';
import { ListKardexMovementsUseCase } from '../../../src/modules/customs/application/use-cases/listKardexMovementsUseCase';
import { CalculateDuaDto } from '../../../src/modules/customs/application/dto/calculateDuaDto';
import { RegisterDuaDto } from '../../../src/modules/customs/application/dto/registerDuaDto';

describe('CustomsController', () => {
  let controller: CustomsController;
  let calculateDuaUseCase: jest.Mocked<CalculateDuaUseCase>;
  let registerDuaUseCase: jest.Mocked<RegisterDuaUseCase>;
  let getCustomsDeclarationByIdUseCase: jest.Mocked<GetCustomsDeclarationByIdUseCase>;
  let listCustomsDeclarationsUseCase: jest.Mocked<ListCustomsDeclarationsUseCase>;
  let listKardexMovementsUseCase: jest.Mocked<ListKardexMovementsUseCase>;

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

    listKardexMovementsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListKardexMovementsUseCase>;

    controller = new CustomsController(
      calculateDuaUseCase,
      registerDuaUseCase,
      getCustomsDeclarationByIdUseCase,
      listCustomsDeclarationsUseCase,
      listKardexMovementsUseCase,
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
      ad_valorem_rate: 6,
      perception_rate: 3.5,
    };

    const result = controller.calculateLiquidation(dto);

    expect(result).toEqual(mockResponse);
    expect(calculateDuaUseCase.execute).toHaveBeenCalledWith(dto);
  });

  it('debe delegar el registro de DAM al caso de uso con el companyId resuelto', async () => {
    const mockResult = {
      id: 'dam-123',
      dua_number: '118-2026-10-012345',
      customs_agency_code: '118',
      regime_code: '10',
      numeration_date: new Date('2026-10-15T12:00:00Z'),
      cif_value_usd: 12000,
      cif_value_pen: 45600,
      ad_valorem_amount_pen: 2736,
      igv_ipm_amount_pen: 8700.48,
      perception_amount_pen: 1996.18,
      total_customs_taxes_pen: 13432.66,
      status: 'LIQUIDADO',
      items_count: 1,
      items: [],
      kardex_movements_registered: 1,
    };

    registerDuaUseCase.execute.mockResolvedValue(mockResult);

    const dto: RegisterDuaDto = {
      dua_number: '118-2026-10-012345',
      customs_agency_code: '118',
      numeration_date: '2026-10-15T12:00:00.000Z',
      fob_value_usd: 1000,
      freight_value_usd: 100,
      insurance_value_usd: 50,
      exchange_rate: 3.8,
      ad_valorem_rate: 6,
      perception_rate: 3.5,
      items: [
        {
          item_order: 1,
          hs_code: '8471300000',
          commercial_description: 'Laptop',
          quantity: 1,
          unit_code: 'NIU',
          fob_unit_usd: 1000,
        },
      ],
    };

    const result = await controller.registerDeclaration('comp-001', dto);
    expect(result).toEqual(mockResult);
    expect(registerDuaUseCase.execute).toHaveBeenCalledWith(dto, 'comp-001');
  });

  it('debe delegar la consulta de detalle por ID al caso de uso', async () => {
    const mockDetail = {
      id: 'dam-123',
      dua_number: '118-2026-10-012345',
      customs_agency_code: '118',
      regime_code: '10',
      numeration_date: new Date('2026-10-15T12:00:00Z'),
      fob_value_usd: 1000,
      freight_value_usd: 100,
      insurance_value_usd: 50,
      cif_value_usd: 1150,
      exchange_rate: 3.8,
      cif_value_pen: 4370,
      ad_valorem_rate: 6,
      ad_valorem_amount_pen: 262.2,
      igv_rate: 16,
      ipm_rate: 2,
      igv_ipm_amount_pen: 833.8,
      perception_rate: 3.5,
      perception_amount_pen: 191.31,
      total_customs_taxes_pen: 1287.31,
      status: 'LIQUIDADO',
      items: [],
    };

    getCustomsDeclarationByIdUseCase.execute.mockResolvedValue(mockDetail);

    const result = await controller.getDeclarationById('dam-123', 'comp-001');
    expect(result).toEqual(mockDetail);
    expect(getCustomsDeclarationByIdUseCase.execute).toHaveBeenCalledWith('dam-123', 'comp-001');
  });

  it('debe delegar el listado de declaraciones al caso de uso', async () => {
    const mockList = [
      {
        id: 'dam-123',
        duaNumber: '118-2026-10-012345',
        customsAgencyCode: '118',
        numerationDate: new Date('2026-10-15T12:00:00Z'),
        cifValueUsd: 12000,
        cifValuePen: 45600,
        totalCustomsTaxesPen: 13432.66,
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

  it('debe delegar el listado de movimientos de Kardex al caso de uso', async () => {
    const mockKardex = [
      {
        id: 'kardex-1',
        companyId: 'comp-001',
        movementDate: new Date('2026-10-15'),
        movementType: 'INGRESO_IMPORTACION' as const,
        itemCode: '8471300000',
        description: 'Laptop',
        quantityIn: 10,
        unitCostIn: 2900.16,
        totalCostIn: 29001.6,
        quantityOut: 0,
        unitCostOut: 0,
        totalCostOut: 0,
        finalStockQuantity: 10,
        finalAverageUnitCost: 2900.16,
        finalTotalInventoryValue: 29001.6,
      },
    ];

    listKardexMovementsUseCase.execute.mockResolvedValue(mockKardex);

    const result = await controller.listKardexMovements('comp-001');
    expect(result).toEqual(mockKardex);
    expect(listKardexMovementsUseCase.execute).toHaveBeenCalledWith('comp-001');
  });
});
