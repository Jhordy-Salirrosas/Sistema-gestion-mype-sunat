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
  });
});

