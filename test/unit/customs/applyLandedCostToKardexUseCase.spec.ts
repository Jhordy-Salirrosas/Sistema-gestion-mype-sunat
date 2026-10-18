import { ApplyLandedCostToKardexUseCase } from '../../../src/modules/customs/application/use-cases/applyLandedCostToKardexUseCase';
import type { ILandedCostRepositoryPort } from '../../../src/modules/customs/domain/ports/landedCostRepositoryPort';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';
import type { ICustomsRepositoryPort } from '../../../src/modules/customs/domain/ports/customsRepositoryPort';
import { ShipmentStatus } from '../../../src/modules/customs/domain/enums/shipmentStatus.enum';

describe('ApplyLandedCostToKardexUseCase', () => {
  let useCase: ApplyLandedCostToKardexUseCase;
  let mockLandedCostRepo: jest.Mocked<ILandedCostRepositoryPort>;
  let mockShipmentRepo: jest.Mocked<ICustomsShipmentRepositoryPort>;
  let mockCustomsRepo: jest.Mocked<ICustomsRepositoryPort>;

  beforeEach(() => {
    mockLandedCostRepo = {
      addLocalExpense: jest.fn(),
      findLocalExpensesByShipmentId: jest.fn(),
      deleteLocalExpense: jest.fn(),
      saveLandedCostSheet: jest.fn(),
      findLandedCostSheetByShipmentId: jest.fn(),
    };
    mockShipmentRepo = {
      createShipment: jest.fn(),
      updateShipmentStatus: jest.fn(),
      findShipmentById: jest.fn(),
      findShipmentByNumber: jest.fn(),
      listShipments: jest.fn(),
      addDocument: jest.fn(),
      addEvent: jest.fn(),
      getShipmentEvents: jest.fn(),
      getShipmentDocuments: jest.fn(),
    };
    mockCustomsRepo = {
      saveDeclarationWithItemsAndKardex: jest.fn(),
      findDeclarationById: jest.fn(),
      findDeclarationsByCompany: jest.fn(),
      findKardexMovementsByCompany: jest.fn(),
      findLatestKardexMovementByItem: jest.fn(),
      registerKardexMovements: jest.fn(),
    };
    useCase = new ApplyLandedCostToKardexUseCase(
      mockLandedCostRepo,
      mockShipmentRepo,
      mockCustomsRepo,
    );
  });

  it('debe registrar el ingreso por importación al Kardex bajo promedio ponderado móvil y cerrar el expediente', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({
      id: 'ship-123',
      shipment_number: 'EXP-2026-0001',
      declarations: [
        {
          id: 'decl-123',
          dua_number: '118-2026-10-001234',
          items: [
            {
              id: 'item-1',
              product_code: 'LAP-001',
              hs_code: '8471300000',
              commercial_description: 'LAPTOPS CORE I7',
              quantity: 100,
              landed_cost_unit_pen: 2008.6875,
              final_landed_cost_unit_pen: 2053.6875,
            },
          ],
        },
      ],
    });

    mockLandedCostRepo.findLandedCostSheetByShipmentId.mockResolvedValue({
      id: 'sheet-1',
      shipment_id: 'ship-123',
      total_inventory_cost_pen: 205368.75,
    });

    // Saldo previo en almacén: 50 laptops a S/ 2,000 c/u
    mockCustomsRepo.findLatestKardexMovementByItem.mockResolvedValue({
      id: 'prev-mov',
      companyId: 'comp-1',
      movementDate: new Date('2026-01-10'),
      movementType: 'INGRESO_IMPORTACION',
      itemCode: 'LAP-001',
      description: 'LAPTOPS CORE I7',
      quantityIn: 50,
      unitCostIn: 2000.0,
      totalCostIn: 100000.0,
      quantityOut: 0,
      unitCostOut: 0,
      totalCostOut: 0,
      finalStockQuantity: 50,
      finalAverageUnitCost: 2000.0,
      finalTotalInventoryValue: 100000.0,
    });

    mockCustomsRepo.registerKardexMovements.mockResolvedValue();
    mockShipmentRepo.updateShipmentStatus.mockResolvedValue({ id: 'ship-123' });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-kardex' });

    const result = await useCase.execute({ shipment_id: 'ship-123' }, 'comp-1');

    expect(result.movements_count).toBe(1);
    const movement = result.movements[0];
    // Nuevo Stock: 50 + 100 = 150 laptops
    expect(movement.finalStockQuantity).toBe(150);
    // Costo promedio: (100,000 + 205,368.75) / 150 = 305,368.75 / 150 = 2,035.7917 PEN
    expect(movement.finalAverageUnitCost).toBe(2035.7917);
    expect(mockCustomsRepo.registerKardexMovements).toHaveBeenCalledTimes(1);
    expect(mockShipmentRepo.updateShipmentStatus).toHaveBeenCalledWith(
      'ship-123',
      'comp-1',
      ShipmentStatus.CERRADO,
    );
  });
});
