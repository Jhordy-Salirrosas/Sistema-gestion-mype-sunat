import { ProcessImportCostOrderUseCase } from '../../../src/modules/inventory/application/use-cases/processImportCostOrderUseCase';
import { InventoryWarehouseEntity } from '../../../src/modules/inventory/domain/entities/inventoryWarehouseEntity';
import { InventoryProductEntity } from '../../../src/modules/inventory/domain/entities/inventoryProductEntity';

describe('ProcessImportCostOrderUseCase', () => {
  let useCase: ProcessImportCostOrderUseCase;
  let warehouseRepoMock: any;
  let productRepoMock: any;
  let balanceRepoMock: any;
  let movementRepoMock: any;

  const defaultWarehouse = new InventoryWarehouseEntity({
    id: 'wh-1',
    companyId: 'comp-100',
    warehouseCode: 'ALM-01',
    sunatEstablishmentCode: '0000',
    description: 'Almacén Central',
  });

  const productLap = new InventoryProductEntity({
    id: 'prod-lap',
    companyId: 'comp-100',
    sku: 'LAP-001',
    description: 'Laptop Gamer 16GB',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
  });

  beforeEach(() => {
    warehouseRepoMock = {
      findByCode: jest.fn().mockResolvedValue(defaultWarehouse),
      ensureDefaultWarehouse: jest.fn().mockResolvedValue(defaultWarehouse),
    };

    productRepoMock = {
      findOrCreateBySku: jest.fn().mockResolvedValue(productLap),
    };

    balanceRepoMock = {
      findByWarehouseAndProduct: jest.fn().mockResolvedValue(null),
      upsertBalance: jest.fn().mockImplementation((b) => Promise.resolve(b)),
    };

    movementRepoMock = {
      findBySourceReference: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((m) => Promise.resolve(m)),
    };

    useCase = new ProcessImportCostOrderUseCase(
      warehouseRepoMock,
      productRepoMock,
      balanceRepoMock,
      movementRepoMock,
    );
  });

  it('procesa exitosamente una orden de costo de importación para mercaderías comerciales', async () => {
    const result = await useCase.execute({
      companyId: 'comp-100',
      shipmentId: 'ship-101',
      damNumber: '118-2026-10-000555',
      items: [
        {
          sku: 'LAP-001',
          description: 'Laptop Gamer 16GB',
          receivedQuantity: 50,
          unitLandedCostPen: 3500.5,
          destinationType: 'MERCADERIA',
        },
      ],
    });

    expect(result.processedMovements).toBe(1);
    expect(result.skippedFixedAssets).toBe(0);
    expect(result.itemsSummary[0].resultingStock).toBe(50);
    expect(result.itemsSummary[0].unitCost).toBe(3500.5);

    expect(movementRepoMock.create).toHaveBeenCalledTimes(1);
    const createdMovement = movementRepoMock.create.mock.calls[0][0];
    expect(createdMovement.operationTypeCode).toBe('18'); // Importación Tabla 12
    expect(createdMovement.documentTypeCode).toBe('50');  // DAM Tabla 10
    expect(createdMovement.quantity).toBe(50);
    expect(createdMovement.unitCost).toBe(3500.5);
    expect(createdMovement.sourceReferenceId).toBe('ship-101');

    expect(balanceRepoMock.upsertBalance).toHaveBeenCalledTimes(1);
  });

  it('omite mercaderías catalogadas como ACTIVO_FIJO del Kardex comercial', async () => {
    const result = await useCase.execute({
      companyId: 'comp-100',
      shipmentId: 'ship-102',
      damNumber: '118-2026-10-000556',
      items: [
        {
          sku: 'SRV-001',
          description: 'Servidor Rack para TI',
          receivedQuantity: 2,
          unitLandedCostPen: 15000,
          destinationType: 'ACTIVO_FIJO',
        },
      ],
    });

    expect(result.processedMovements).toBe(0);
    expect(result.skippedFixedAssets).toBe(1);
    expect(movementRepoMock.create).not.toHaveBeenCalled();
    expect(balanceRepoMock.upsertBalance).not.toHaveBeenCalled();
  });

  it('respeta idempotencia y no duplica movimientos si ya fue procesado', async () => {
    movementRepoMock.findBySourceReference.mockResolvedValueOnce({
      id: 'mov-existente',
      resultingStock: 50,
      unitCost: 3500.5,
    });

    const result = await useCase.execute({
      companyId: 'comp-100',
      shipmentId: 'ship-101',
      damNumber: '118-2026-10-000555',
      items: [
        {
          sku: 'LAP-001',
          description: 'Laptop Gamer 16GB',
          receivedQuantity: 50,
          unitLandedCostPen: 3500.5,
          destinationType: 'MERCADERIA',
        },
      ],
    });

    expect(result.processedMovements).toBe(0);
    expect(result.alreadyProcessedCount).toBe(1);
    expect(movementRepoMock.create).not.toHaveBeenCalled();
    expect(balanceRepoMock.upsertBalance).not.toHaveBeenCalled();
  });
});

