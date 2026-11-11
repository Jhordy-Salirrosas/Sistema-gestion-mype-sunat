import { BadRequestException } from '@nestjs/common';
import { InventoryCostLayerService } from '../../../src/modules/inventory/application/services/inventoryCostLayerService';

describe('InventoryCostLayerService', () => {
  const prisma = { $executeRaw: jest.fn(),
    company: { findUnique: jest.fn(), update: jest.fn() },
    inventoryCostLayer: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    inventoryProduct: { count: jest.fn() },
    inventoryWarehouse: { count: jest.fn() },
    inventoryMovement: { count: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    inventoryBalance: { findMany: jest.fn(), upsert: jest.fn() },
  };
  const service = new InventoryCostLayerService(prisma as never);
  beforeEach(() => jest.clearAllMocks());

  it('lee el método de la empresa', async () => {
    prisma.company.findUnique.mockResolvedValue({ inventory_cost_method: 'FIFO' });
    await expect(service.metodo('c1')).resolves.toBe('FIFO');
    prisma.company.findUnique.mockResolvedValue(null);
    await expect(service.metodo('c1')).resolves.toBe('PROMEDIO');
  });

  it('lista capas abiertas', async () => {
    prisma.inventoryCostLayer.findMany.mockResolvedValue([{ quantity_remaining: 2, unit_cost: 10 }]);
    await expect(service.capas('c1', 'w1', 'p1')).resolves.toEqual([{ quantity: 2, unitCost: 10 }]);
  });

  it('registra una capa de entrada', async () => {
    prisma.inventoryCostLayer.create.mockResolvedValue({ id: 'l1' });
    await service.registrarEntrada('c1', 'w1', 'p1', 5, 20);
    expect(prisma.inventoryCostLayer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity_remaining: 5, unit_cost: 20 }),
    });
  });

  it('consume capas en orden', async () => {
    prisma.inventoryCostLayer.findMany.mockResolvedValue([
      { id: 'l1', quantity_remaining: 2, unit_cost: 10 }, { id: 'l2', quantity_remaining: 5, unit_cost: 20 },
    ]);
    prisma.inventoryCostLayer.update.mockResolvedValue({});
    await service.consumir('c1', 'w1', 'p1', 4);
    expect(prisma.inventoryCostLayer.update).toHaveBeenCalledTimes(2);
  });

  it('obtiene la configuración y valuación del inventario', async () => {
    prisma.company.findUnique.mockResolvedValue({
      id: 'c1',
      ruc: '20123456789',
      legal_name: 'EMPRESA DEMO S.A.C.',
      inventory_cost_method: 'PROMEDIO',
      updated_at: new Date('2026-11-01'),
    });
    prisma.inventoryProduct.count.mockResolvedValue(10);
    prisma.inventoryWarehouse.count.mockResolvedValue(2);
    prisma.inventoryMovement.count.mockResolvedValue(45);
    prisma.inventoryBalance.findMany.mockResolvedValue([
      { total_inventory_value: 1500.5 },
      { total_inventory_value: 2300 },
    ]);

    const config = await service.getCostConfig('c1');
    expect(config.currentMethod).toBe('PROMEDIO');
    expect(config.companyRuc).toBe('20123456789');
    expect(config.productsCount).toBe(10);
    expect(config.totalInventoryValuePen).toBe(3800.5);
  });

  it('actualiza el método de costeo de la empresa', async () => {
    prisma.company.update.mockResolvedValue({ id: 'c1', inventory_cost_method: 'FIFO' });
    const res = await service.updateCostMethod('c1', 'FIFO');
    expect(res.success).toBe(true);
    expect(res.method).toBe('FIFO');
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { inventory_cost_method: 'FIFO' },
    });
  });

  it('recalcula costeo integral en método PROMEDIO', async () => {
    prisma.company.findUnique.mockResolvedValue({ inventory_cost_method: 'PROMEDIO' });
    prisma.company.update.mockResolvedValue({});
    prisma.inventoryBalance.findMany
      .mockResolvedValueOnce([{ total_inventory_value: 100 }]) // previous
      .mockResolvedValueOnce([{ total_inventory_value: 150 }]); // final

    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 'm1',
        warehouse_id: 'w1',
        product_id: 'p1',
        direction: 'ENTRADA',
        quantity: 10,
        unit_cost: 15,
        total_cost: 150,
        movement_date: new Date('2026-11-01'),
      },
    ]);
    prisma.inventoryMovement.update.mockResolvedValue({});
    prisma.inventoryBalance.upsert.mockResolvedValue({});

    const result = await service.recalculateCosting('c1', 'PROMEDIO');
    expect(result.success).toBe(true);
    expect(result.method).toBe('PROMEDIO');
    expect(result.movementsCount).toBe(1);
    expect(result.previousValuationPen).toBe(100);
    expect(result.newValuationPen).toBe(150);
    expect(result.differencePen).toBe(50);
  });

  it('delega calcular y valida métodos inválidos en updateCostMethod y recalculateCosting', async () => {
    const calc = service.calcular([], 'ENTRADA', 5, 10);
    expect(calc.resultingStock).toBe(5);
    await expect(service.updateCostMethod('c1', 'LIFO' as any)).rejects.toThrow(BadRequestException);
    await expect(service.recalculateCosting('c1', 'LIFO' as any)).rejects.toThrow(BadRequestException);
  });

  it('recalcula PROMEDIO con salidas válidas y salidas sin stock', async () => {
    prisma.company.findUnique.mockResolvedValue({ inventory_cost_method: 'PROMEDIO' });
    prisma.inventoryBalance.findMany
      .mockResolvedValueOnce([{ total_inventory_value: 200 }])
      .mockResolvedValueOnce([{ total_inventory_value: 0 }]);
    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 'm-1',
        warehouse_id: 'w1',
        product_id: 'p1',
        direction: 'ENTRADA',
        quantity: 10,
        unit_cost: 20,
        total_cost: 200,
        movement_date: new Date('2026-11-01'),
      },
      {
        id: 'm-2',
        warehouse_id: 'w1',
        product_id: 'p1',
        direction: 'SALIDA',
        quantity: 10,
        unit_cost: 0,
        total_cost: 0,
        movement_date: new Date('2026-11-02'),
      },
      {
        id: 'm-3',
        warehouse_id: 'w1',
        product_id: 'p1',
        direction: 'SALIDA',
        quantity: 2,
        unit_cost: 0,
        total_cost: 0,
        movement_date: new Date('2026-11-03'),
      },
    ]);
    prisma.inventoryMovement.update.mockResolvedValue({});
    prisma.inventoryBalance.upsert.mockResolvedValue({});

    const res = await service.recalculateCosting('c1');
    expect(res.method).toBe('PROMEDIO');
    expect(res.movementsCount).toBe(3);
  });

  it('recalcula FIFO regenerando capas de costo y procesando entradas y salidas', async () => {
    prisma.company.update.mockResolvedValue({});
    prisma.inventoryCostLayer.deleteMany.mockResolvedValue({});
    prisma.inventoryCostLayer.create.mockResolvedValue({});
    prisma.inventoryBalance.findMany
      .mockResolvedValueOnce([{ total_inventory_value: 300 }])
      .mockResolvedValueOnce([{ total_inventory_value: 180 }]);
    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 'f-0',
        warehouse_id: 'w1',
        product_id: 'p1',
        direction: 'SALIDA',
        quantity: 1,
        unit_cost: 0,
        total_cost: 0,
        movement_date: new Date('2026-10-31'),
      },
      {
        id: 'f-1',
        warehouse_id: 'w1',
        product_id: 'p1',
        direction: 'ENTRADA',
        quantity: 10,
        unit_cost: 15,
        total_cost: 150,
        movement_date: new Date('2026-11-01'),
      },
      {
        id: 'f-2',
        warehouse_id: 'w1',
        product_id: 'p1',
        direction: 'SALIDA',
        quantity: 4,
        unit_cost: 0,
        total_cost: 0,
        movement_date: new Date('2026-11-02'),
      },
    ]);
    prisma.inventoryMovement.update.mockResolvedValue({});
    prisma.inventoryBalance.upsert.mockResolvedValue({});

    const res = await service.recalculateCosting('c1', 'FIFO');
    expect(res.method).toBe('FIFO');
    expect(res.movementsCount).toBe(3);
    expect(prisma.inventoryCostLayer.deleteMany).toHaveBeenCalled();
    expect(prisma.inventoryCostLayer.create).toHaveBeenCalled();
  });
});
