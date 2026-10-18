import { ListKardexMovementsUseCase } from '../../../src/modules/customs/application/use-cases/listKardexMovementsUseCase';
import type { ICustomsRepositoryPort, KardexMovementRecord } from '../../../src/modules/customs/domain/ports/customsRepositoryPort';

describe('ListKardexMovementsUseCase', () => {
  let useCase: ListKardexMovementsUseCase;
  let mockCustomsRepo: jest.Mocked<ICustomsRepositoryPort>;

  beforeEach(() => {
    mockCustomsRepo = {
      saveDeclarationWithItemsAndKardex: jest.fn(),
      findDeclarationById: jest.fn(),
      findDeclarationsByCompany: jest.fn(),
      findKardexMovementsByCompany: jest.fn(),
      findLatestKardexMovementByItem: jest.fn(),
      registerKardexMovements: jest.fn(),
    };

    useCase = new ListKardexMovementsUseCase(mockCustomsRepo);
  });

  it('debe delegar la consulta de movimientos kardex por empresa al repositorio aduanero', async () => {
    const mockMovements: KardexMovementRecord[] = [
      {
        id: 'kardex-1',
        companyId: 'comp-1',
        movementDate: new Date('2026-03-20'),
        movementType: 'INGRESO_IMPORTACION',
        itemCode: 'LAPTOP-I7',
        description: 'Laptop Core i7',
        quantityIn: 100,
        unitCostIn: 4004,
        totalCostIn: 400400,
        quantityOut: 0,
        unitCostOut: 0,
        totalCostOut: 0,
        finalStockQuantity: 100,
        finalAverageUnitCost: 4004,
        finalTotalInventoryValue: 400400,
        createdAt: new Date('2026-03-20'),
      },
    ];

    mockCustomsRepo.findKardexMovementsByCompany.mockResolvedValue(mockMovements);

    const result = await useCase.execute('comp-1');

    expect(result).toEqual(mockMovements);
    expect(mockCustomsRepo.findKardexMovementsByCompany).toHaveBeenCalledWith('comp-1');
  });
});
