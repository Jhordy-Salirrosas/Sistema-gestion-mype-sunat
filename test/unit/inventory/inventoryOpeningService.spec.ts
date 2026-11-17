import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InventoryOpeningService } from '../../../src/modules/inventory/application/services/inventoryOpeningService';

describe('InventoryOpeningService', () => {
  let service: InventoryOpeningService;
  let mockPrisma: any;

  const companyId = 'comp-100';

  beforeEach(() => {
    mockPrisma = {
      $executeRaw: jest.fn(), company: { findUnique: jest.fn(async () => ({ inventory_cost_method: 'PROMEDIO' })) },
      inventoryCostLayer: { findMany: jest.fn(async () => [{ id: 'layer', quantity_remaining: 100000, unit_cost: 1 }]), update: jest.fn(), create: jest.fn(async () => ({ id: 'layer-new' })) },
      accountingPeriod: {
        findFirst: jest.fn(async () => null),
      },
      accountingEntry: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async (args) => ({ id: 'entry-uuid-1', ...args.data })),
      },
      inventoryWarehouse: {
        findFirst: jest.fn(),
      },
      inventoryProduct: {
        findFirst: jest.fn(),
      },
      inventoryMovement: {
        findFirst: jest.fn(),
        create: jest.fn(async () => ({ id: 'mov' })),
      },
      inventoryBalance: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    service = new InventoryOpeningService(mockPrisma);
  });

  it('lanza BadRequestException si hay SKUs repetidos', async () => {
    await expect(
      service.create(companyId, {
        items: [
          { sku: 'SKU-1', quantity: 10, unitCost: 100 },
          { sku: 'SKU-1', quantity: 5, unitCost: 100 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza NotFoundException si el almacén no existe', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue(null);

    await expect(
      service.create(companyId, {
        warehouseCode: 'ALM-99',
        items: [{ sku: 'SKU-1', quantity: 10, unitCost: 100 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza NotFoundException si el producto no existe', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue(null);

    await expect(
      service.create(companyId, {
        items: [{ sku: 'NON-EXISTENT', quantity: 10, unitCost: 100 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza BadRequestException si el producto es servicio y no inventariable', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'p-1',
      sku: 'SRV-01',
      is_inventory: false,
    });

    await expect(
      service.create(companyId, {
        items: [{ sku: 'SRV-01', quantity: 10, unitCost: 100 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza ConflictException si ya existe un saldo inicial para el SKU en la fecha', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'p-1',
      sku: 'SKU-1',
      is_inventory: true,
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({ id: 'mov-exist' });

    await expect(
      service.create(companyId, {
        openingDate: '2026-01-01',
        items: [{ sku: 'SKU-1', quantity: 10, unitCost: 100 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('crea el saldo inicial correctamente con movimientos y saldos', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'p-1',
      sku: 'SKU-1',
      description: 'Producto Test',
      is_inventory: true,
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue(null);
    mockPrisma.inventoryBalance.findUnique.mockResolvedValue(null);

    const res = await service.create(companyId, {
      warehouseCode: 'ALM-01',
      openingDate: '2026-01-01',
      items: [{ sku: 'SKU-1', quantity: 50, unitCost: 120 }],
    });

    expect(res.warehouseCode).toBe('ALM-01');
    expect(res.items.length).toBe(1);
    expect(res.items[0].resultingStock).toBe(50);
    expect(res.items[0].resultingAverageCost).toBe(120);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalled();
    expect(mockPrisma.inventoryBalance.upsert).toHaveBeenCalled();
    expect(mockPrisma.inventoryCostLayer.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity_remaining: 50, unit_cost: 120, source_movement_id: 'mov' }) }));
    expect(mockPrisma.accountingEntry.create).toHaveBeenCalled();
    expect(res.accountingEntryId).toBe('entry-uuid-1');
  });

  it('lanza BadRequestException si el período contable está CERRADO', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
      id: 'ap-1',
      period: '2026-01',
      status: 'CERRADO',
    });

    await expect(
      service.create(companyId, {
        period: '2026-01',
        items: [{ sku: 'SKU-1', quantity: 10, unitCost: 100 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException si el costo unitario no es un número finito', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'p-1',
      sku: 'SKU-1',
      is_inventory: true,
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue(null);
    mockPrisma.inventoryBalance.findUnique.mockResolvedValue(null);

    await expect(
      service.create(companyId, {
        items: [{ sku: 'SKU-1', quantity: 10, unitCost: null as any }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('genera asiento con cuenta 4699 cuando openingReason es LIQUIDACION_QUIEBRA', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'p-1',
      sku: 'SKU-1',
      description: 'Producto Test',
      is_inventory: true,
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue(null);
    mockPrisma.inventoryBalance.findUnique.mockResolvedValue(null);
    mockPrisma.accountingEntry.findFirst.mockResolvedValue({ entry_number: 10 });

    const res = await service.create(companyId, {
      openingReason: 'LIQUIDACION_QUIEBRA',
      period: '2026-02',
      documentTypeCode: '00',
      documentSerial: 'LIQ',
      documentNumber: '001',
      notes: 'Quiebra inventario adjudicado',
      items: [{ sku: 'SKU-1', quantity: 10, unitCost: 50 }],
    });

    expect(res.openingReason).toBe('LIQUIDACION_QUIEBRA');
    expect(mockPrisma.accountingEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          period: '2026-02',
          entry_number: 11,
          journal_code: 'APE',
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({ account_code: '20111', debit_amount: 500 }),
              expect.objectContaining({ account_code: '4699', credit_amount: 500 }),
            ]),
          },
        }),
      }),
    );
  });

  it('genera asiento con cuenta 5911 cuando openingReason es EJERCICIO_ANTERIOR', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'p-1',
      sku: 'SKU-1',
      description: 'Producto Test',
      is_inventory: true,
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue(null);
    mockPrisma.inventoryBalance.findUnique.mockResolvedValue(null);

    await service.create(companyId, {
      openingReason: 'EJERCICIO_ANTERIOR',
      items: [{ sku: 'SKU-1', quantity: 2, unitCost: 100 }],
    });

    expect(mockPrisma.accountingEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({ account_code: '5911', credit_amount: 200 }),
            ]),
          },
        }),
      }),
    );
  });

  it('no genera asiento si generateAccountingEntry es false', async () => {
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'p-1',
      sku: 'SKU-1',
      description: 'Producto Test',
      is_inventory: true,
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue(null);
    mockPrisma.inventoryBalance.findUnique.mockResolvedValue(null);

    const res = await service.create(companyId, {
      generateAccountingEntry: false,
      items: [{ sku: 'SKU-1', quantity: 2, unitCost: 100 }],
    });

    expect(mockPrisma.accountingEntry.create).not.toHaveBeenCalled();
    expect(res.accountingEntryId).toBeUndefined();
  });

  it('no interrumpe el saldo inicial si la creación del asiento contable lanza error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
    mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
      id: 'p-1',
      sku: 'SKU-1',
      description: 'Producto Test',
      is_inventory: true,
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue(null);
    mockPrisma.inventoryBalance.findUnique.mockResolvedValue(null);
    mockPrisma.accountingEntry.create.mockRejectedValueOnce(new Error('Accounting DB fail'));

    const res = await service.create(companyId, {
      items: [{ sku: 'SKU-1', quantity: 1, unitCost: 100 }],
    });

    expect(res.items.length).toBe(1);
    expect(res.accountingEntryId).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

