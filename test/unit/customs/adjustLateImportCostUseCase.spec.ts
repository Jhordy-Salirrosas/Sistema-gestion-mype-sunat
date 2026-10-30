import { AdjustLateImportCostUseCase } from '../../../src/modules/customs/application/use-cases/adjustLateImportCostUseCase';
import { NotFoundException } from '@nestjs/common';

describe('AdjustLateImportCostUseCase (Application Use Case)', () => {
  let useCase: AdjustLateImportCostUseCase;
  let mockLandedCostRepo: any;
  let mockShipmentRepo: any;

  beforeEach(() => {
    mockLandedCostRepo = {
      addLocalExpense: jest.fn().mockImplementation(async (d) => ({ id: 'exp-01', ...d })),
      findLandedCostSheetByShipmentId: jest.fn(),
      saveLandedCostSheet: jest.fn().mockResolvedValue({}),
    };
    mockShipmentRepo = {
      findShipmentById: jest.fn(),
    };
    useCase = new AdjustLateImportCostUseCase(mockLandedCostRepo, mockShipmentRepo);
  });

  it('debe registrar gasto tardío y marcar la hoja de costos para recálculo', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({ id: 'ship-01', company_id: 'comp-1' });
    mockLandedCostRepo.findLandedCostSheetByShipmentId.mockResolvedValue({
      shipment_id: 'ship-01',
      total_cif_pen: 50000,
      total_duties_pen: 0,
      total_local_expenses_pen: 2000,
      total_inventory_cost_pen: 52000,
    });

    const result = await useCase.execute(
      {
        shipmentId: 'ship-01',
        supplierRuc: '20100047218',
        supplierName: 'APM TERMINALS',
        expenseConcept: 'DEMURRAGE',
        invoiceSerialNumber: 'F001-9988',
        issueDate: '2026-04-01',
        netAmountPen: 1200,
        igvAmountPen: 216,
        totalAmountPen: 1416,
      },
      'comp-1',
    );

    expect(result.requiresRecalculation).toBe(true);
    expect(mockLandedCostRepo.addLocalExpense).toHaveBeenCalled();
    expect(mockLandedCostRepo.saveLandedCostSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'A_RECALCULAR',
        approvedByAccountant: false,
      }),
    );
  });

  it('debe lanzar NotFoundException si el expediente no existe', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          shipmentId: 'ship-inexistente',
          supplierRuc: '20100047218',
          supplierName: 'APM',
          expenseConcept: 'DEMURRAGE',
          invoiceSerialNumber: 'F001-1',
          issueDate: '2026-04-01',
          netAmountPen: 500,
          igvAmountPen: 90,
          totalAmountPen: 590,
        },
        'comp-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

