import { CalculateLandedCostUseCase } from '../../../src/modules/customs/application/use-cases/calculateLandedCostUseCase';
import type { ILandedCostRepositoryPort } from '../../../src/modules/customs/domain/ports/landedCostRepositoryPort';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';

describe('CalculateLandedCostUseCase', () => {
  let useCase: CalculateLandedCostUseCase;
  let mockLandedCostRepo: jest.Mocked<ILandedCostRepositoryPort>;
  let mockShipmentRepo: jest.Mocked<ICustomsShipmentRepositoryPort>;

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
    useCase = new CalculateLandedCostUseCase(mockLandedCostRepo, mockShipmentRepo);
  });

  it('debe calcular y prorratear los costos locales conforme a NIC 2 aislando el IGV', async () => {
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
              fob_total_usd: 50000.0,
              allocated_cif_pen: 200868.75,
              allocated_duties_pen: 0.0,
              net_weight_kg: 250.0,
            },
          ],
        },
      ],
    });

    mockLandedCostRepo.findLocalExpensesByShipmentId.mockResolvedValue([
      {
        id: 'exp-1',
        expense_concept: 'ALMACENAJE_PORTUARIO',
        supplier_ruc: '20100047218',
        invoice_serial_number: 'F001-001234',
        net_amount_pen: 3000.0,
        igv_amount_pen: 540.0,
        total_amount_pen: 3540.0,
        is_capitalizable: true,
        proration_method: 'VALOR_FOB',
      },
      {
        id: 'exp-2',
        expense_concept: 'AGENTE_ADUANAS',
        supplier_ruc: '20509988112',
        invoice_serial_number: 'E001-005678',
        net_amount_pen: 1500.0,
        igv_amount_pen: 270.0,
        total_amount_pen: 1770.0,
        is_capitalizable: true,
        proration_method: 'VALOR_FOB',
      },
    ]);

    mockLandedCostRepo.saveLandedCostSheet.mockImplementation(async (data) => ({
      id: 'sheet-1',
      ...data,
    }));
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-cost' });

    const result = await useCase.execute({ shipment_id: 'ship-123' }, 'comp-1');

    expect(result.sheet).toBeDefined();
    expect(result.proration).toBeDefined();
    // 3000 + 1500 = 4500 en gastos locales capitalizables
    expect(result.proration.totalLocalExpensesPen).toBe(4500.0);
    // Costo total de inventario: CIF (200,868.75) + Ad-Valorem (0) + Gastos Locales (4500) = 205,368.75
    expect(result.proration.totalInventoryCostPen).toBe(205368.75);
    // Costo unitario nacionalizado por laptop: 205,368.75 / 100 = 2,053.6875 PEN
    expect(result.proration.items[0].unitLandedCostPen).toBe(2053.6875);
    expect(mockLandedCostRepo.saveLandedCostSheet).toHaveBeenCalledTimes(1);
    expect(mockShipmentRepo.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'COSTEO_LANDED_COST',
      }),
    );
  });
});
