import { RegisterManualMovementUseCase } from '../../../src/modules/inventory/application/use-cases/registerManualMovementUseCase';
import { InventoryWarehouseEntity } from '../../../src/modules/inventory/domain/entities/inventoryWarehouseEntity';
import { InventoryProductEntity } from '../../../src/modules/inventory/domain/entities/inventoryProductEntity';
import { InventoryBalanceEntity } from '../../../src/modules/inventory/domain/entities/inventoryBalanceEntity';

describe('RegisterManualMovementUseCase', () => {
  let useCase: RegisterManualMovementUseCase;
  let warehouseRepoMock: any;
  let productRepoMock: any;
  let balanceRepoMock: any;
  let movementRepoMock: any;

  const defaultWarehouse = new InventoryWarehouseEntity({
    id: 'wh-1',
    companyId: 'comp-100',
    warehouseCode: 'ALM-01',
    description: 'Almacén Central',
  });

  const product = new InventoryProductEntity({
    id: 'prod-1',
    companyId: 'comp-100',
    sku: 'MON-27',
    description: 'Monitor 27 Pulgadas',
  });

  beforeEach(() => {
    warehouseRepoMock = {
      findByCode: jest.fn().mockResolvedValue(defaultWarehouse),
      ensureDefaultWarehouse: jest.fn().mockResolvedValue(defaultWarehouse),
    };

    productRepoMock = {
      findBySku: jest.fn().mockResolvedValue(product),
    };

    balanceRepoMock = {
      findByWarehouseAndProduct: jest.fn().mockResolvedValue(null),
      upsertBalance: jest.fn().mockImplementation((b) => Promise.resolve(b)),
    };

    movementRepoMock = {
      create: jest.fn().mockImplementation((m) => Promise.resolve({ ...m, id: 'mov-1' })),
    };

    useCase = new RegisterManualMovementUseCase(
      warehouseRepoMock,
      productRepoMock,
      balanceRepoMock,
      movementRepoMock,
    );
  });

  it('registra una entrada por compra nacional (Tipo 02) con nuevo saldo y CPP', async () => {
    const result = await useCase.execute(
      {
        sku: 'MON-27',
        direction: 'ENTRADA',
        operation_type_code: '02',
        quantity: 20,
        unit_cost: 600,
        document_type_code: '01',
        document_serial: 'F001',
        document_number: '1234',
      },
      'comp-100',
    );

    expect(result.quantity).toBe(20);
    expect(result.unitCost).toBe(600);
    expect(result.totalCost).toBe(12000);
    expect(result.resultingStock).toBe(20);
    expect(result.resultingAverageCost).toBe(600);
    expect(movementRepoMock.create).toHaveBeenCalled();
    expect(balanceRepoMock.upsertBalance).toHaveBeenCalled();
  });

  it('registra una salida por venta nacional (Tipo 01) reduciendo existencias', async () => {
    // Saldo previo: 20 unidades a 600 PEN = 12000 PEN
    balanceRepoMock.findByWarehouseAndProduct.mockResolvedValueOnce(
      new InventoryBalanceEntity({
        id: 'bal-1',
        companyId: 'comp-100',
        warehouseId: 'wh-1',
        productId: 'prod-1',
        currentStock: 20,
        averageUnitCost: 600,
        totalInventoryValue: 12000,
      }),
    );

    const result = await useCase.execute(
      {
        sku: 'MON-27',
        direction: 'SALIDA',
        operation_type_code: '01',
        quantity: 5,
        document_type_code: '01',
        document_serial: 'F001',
        document_number: '9988',
      },
      'comp-100',
    );

    expect(result.quantity).toBe(5);
    expect(result.unitCost).toBe(600);
    expect(result.totalCost).toBe(3000);
    expect(result.resultingStock).toBe(15);
    expect(result.resultingAverageCost).toBe(600);
    expect(result.resultingTotalValue).toBe(9000);
  });

  it('rechaza una salida si no hay stock suficiente en almacén', async () => {
    balanceRepoMock.findByWarehouseAndProduct.mockResolvedValueOnce(
      new InventoryBalanceEntity({
        companyId: 'comp-100',
        warehouseId: 'wh-1',
        productId: 'prod-1',
        currentStock: 2,
        averageUnitCost: 600,
        totalInventoryValue: 1200,
      }),
    );

    await expect(
      useCase.execute(
        {
          sku: 'MON-27',
          direction: 'SALIDA',
          operation_type_code: '01',
          quantity: 10,
        },
        'comp-100',
      ),
    ).rejects.toThrow(/Stock insuficiente/);
  });
});

