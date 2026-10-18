import { NotFoundException } from '@nestjs/common';
import { AddLocalExpenseUseCase } from '../../../src/modules/customs/application/use-cases/addLocalExpenseUseCase';
import type { ILandedCostRepositoryPort } from '../../../src/modules/customs/domain/ports/landedCostRepositoryPort';
import type { ICustomsShipmentRepositoryPort } from '../../../src/modules/customs/domain/ports/customsShipmentRepositoryPort';

describe('AddLocalExpenseUseCase', () => {
  let useCase: AddLocalExpenseUseCase;
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

    useCase = new AddLocalExpenseUseCase(mockLandedCostRepo, mockShipmentRepo);
  });

  it('debe lanzar NotFoundException si el expediente no existe en la empresa', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          shipment_id: 'ship-unknown',
          supplier_ruc: '20100070970',
          supplier_name: 'Agencia Ransa',
          expense_concept: 'ALMACENAJE',
          invoice_serial_number: 'F001-000456',
          issue_date: '2026-03-20',
          net_amount_pen: 1200,
          igv_amount_pen: 216,
          total_amount_pen: 1416,
        },
        'comp-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('debe registrar el gasto local y auditar el evento exitosamente', async () => {
    mockShipmentRepo.findShipmentById.mockResolvedValue({ id: 'ship-1', company_id: 'comp-1' });
    mockLandedCostRepo.addLocalExpense.mockResolvedValue({
      id: 'expense-1',
      shipment_id: 'ship-1',
      net_amount_pen: 1200,
    });
    mockShipmentRepo.addEvent.mockResolvedValue({ id: 'evt-1' });

    const result = await useCase.execute(
      {
        shipment_id: 'ship-1',
        supplier_ruc: '20100070970',
        supplier_name: 'Agencia Ransa',
        expense_concept: 'ALMACENAJE',
        invoice_serial_number: 'F001-000456',
        issue_date: '2026-03-20',
        net_amount_pen: 1200,
        igv_amount_pen: 216,
        total_amount_pen: 1416,
      },
      'comp-1',
    );

    expect(result.id).toBe('expense-1');
    expect(mockLandedCostRepo.addLocalExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'ship-1',
        expenseConcept: 'ALMACENAJE',
        netAmountPen: 1200,
        spotDetractionRate: 0,
        isCapitalizable: true,
        prorationMethod: 'VALOR_FOB',
      }),
    );
    expect(mockShipmentRepo.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shipmentId: 'ship-1',
        eventType: 'GASTO_LOCAL',
      }),
    );
  });
});
