import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InventoryTransferService } from '../../../src/modules/inventory/application/services/inventoryTransferService';

describe('InventoryTransferService', () => {
  let service: InventoryTransferService;
  let mockPrisma: any;

  const companyId = 'comp-100';

  beforeEach(() => {
    mockPrisma = {
      $executeRaw: jest.fn(), company: { findUnique: jest.fn(async () => ({ inventory_cost_method: 'PROMEDIO' })) },
      inventoryCostLayer: { findMany: jest.fn(async () => [{ id: 'layer', quantity_remaining: 100000, unit_cost: 1 }]), update: jest.fn(), create: jest.fn(async () => ({ id: 'layer-new' })) },
      inventoryTransfer: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      inventoryAdjustment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      inventoryWarehouse: {
        findFirst: jest.fn(),
      },
      inventoryProduct: {
        findFirst: jest.fn(),
      },
      inventoryBalance: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      accountingRule: {
        findMany: jest.fn().mockResolvedValue([{ line_order: 1, account_code: '659' }, { line_order: 2, account_code: '201' }, { line_order: 3, account_code: '759' }]),
      },
      accountingMapping: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    service = new InventoryTransferService(mockPrisma);
  });

  describe('Queries', () => {
    it('lista transferencias y ajustes', async () => {
      mockPrisma.inventoryTransfer.findMany.mockResolvedValue([{ id: 'trf-1' }]);
      mockPrisma.inventoryAdjustment.findMany.mockResolvedValue([{ id: 'adj-1' }]);

      expect(await service.listTransfers(companyId)).toEqual([{ id: 'trf-1' }]);
      expect(await service.listAdjustments(companyId)).toEqual([{ id: 'adj-1' }]);
    });
  });

  describe('createTransfer', () => {
    it('lanza BadRequestException si almacén origen y destino son iguales', async () => {
      await expect(
        service.createTransfer(companyId, {
          fromWarehouseCode: 'ALM-01',
          toWarehouseCode: 'ALM-01',
          items: [{ sku: 'SKU-1', quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si hay SKUs repetidos', async () => {
      await expect(
        service.createTransfer(companyId, {
          fromWarehouseCode: 'ALM-01',
          toWarehouseCode: 'ALM-02',
          items: [
            { sku: 'SKU-1', quantity: 5 },
            { sku: 'SKU-1', quantity: 2 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza ConflictException si el número de transferencia ya existe', async () => {
      mockPrisma.inventoryTransfer.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createTransfer(companyId, {
          fromWarehouseCode: 'ALM-01',
          toWarehouseCode: 'ALM-02',
          transferNumber: 'TRF-001',
          items: [{ sku: 'SKU-1', quantity: 5 }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza NotFoundException si un almacén no existe', async () => {
      mockPrisma.inventoryTransfer.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryWarehouse.findFirst.mockResolvedValueOnce(null); // from

      await expect(
        service.createTransfer(companyId, {
          fromWarehouseCode: 'ALM-01',
          toWarehouseCode: 'ALM-02',
          items: [{ sku: 'SKU-1', quantity: 5 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el stock en origen es insuficiente', async () => {
      mockPrisma.inventoryTransfer.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryWarehouse.findFirst
        .mockResolvedValueOnce({ id: 'w-from', warehouse_code: 'ALM-01' })
        .mockResolvedValueOnce({ id: 'w-to', warehouse_code: 'ALM-02' });

      mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
        id: 'p-1',
        sku: 'SKU-1',
        is_inventory: true,
      });

      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        current_stock: 2,
        average_unit_cost: 100,
        total_inventory_value: 200,
      });

      await expect(
        service.createTransfer(companyId, {
          fromWarehouseCode: 'ALM-01',
          toWarehouseCode: 'ALM-02',
          items: [{ sku: 'SKU-1', quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea la transferencia exitosamente con movimientos y actualización de saldos', async () => {
      mockPrisma.inventoryTransfer.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryWarehouse.findFirst
        .mockResolvedValueOnce({ id: 'w-from', warehouse_code: 'ALM-01' })
        .mockResolvedValueOnce({ id: 'w-to', warehouse_code: 'ALM-02' });

      mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
        id: 'p-1',
        sku: 'SKU-1',
        description: 'Producto 1',
        is_inventory: true,
      });

      // Balance origen (stock 10, cost 50)
      mockPrisma.inventoryBalance.findUnique
        .mockResolvedValueOnce({
          current_stock: 10,
          average_unit_cost: 50,
          total_inventory_value: 500,
        })
        // Balance destino (stock 0, cost 0)
        .mockResolvedValueOnce(null);

      mockPrisma.inventoryTransfer.create.mockResolvedValue({
        id: 'trf-new',
        transfer_number: 'TRF-001',
        status: 'CONFIRMADA',
      });

      const res = await service.createTransfer(companyId, {
        fromWarehouseCode: 'ALM-01',
        toWarehouseCode: 'ALM-02',
        transferNumber: 'TRF-001',
        items: [{ sku: 'SKU-1', quantity: 4 }],
      });

      expect(res.id).toBe('trf-new');
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(2); // 1 salida, 1 entrada
      expect(mockPrisma.inventoryBalance.upsert).toHaveBeenCalledTimes(2);
    });

    it('genera el asiento interno al confirmar la transferencia', async () => {
      const accounting = { execute: jest.fn().mockResolvedValue({ id: 'entry-1' }) };
      const serviceConAsiento = new InventoryTransferService(mockPrisma, accounting as never);
      mockPrisma.inventoryTransfer.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryWarehouse.findFirst
        .mockResolvedValueOnce({ id: 'w-from', warehouse_code: 'ALM-01' })
        .mockResolvedValueOnce({ id: 'w-to', warehouse_code: 'ALM-02' });
      mockPrisma.inventoryProduct.findFirst.mockResolvedValue({ id: 'p-1', sku: 'SKU-1', description: 'Producto 1', is_inventory: true });
      mockPrisma.inventoryBalance.findUnique
        .mockResolvedValueOnce({ current_stock: 10, average_unit_cost: 50, total_inventory_value: 500 })
        .mockResolvedValueOnce(null);
      mockPrisma.inventoryTransfer.create.mockResolvedValue({
        id: 'trf-new', transfer_number: 'TRF-001', transfer_date: new Date('2026-11-06'),
        from_warehouse_code: 'ALM-01', to_warehouse_code: 'ALM-02',
        items: [{ total_cost: 200 }],
      });
      mockPrisma.accountingMapping.findMany.mockResolvedValue([
        { role_code: 'ALMACEN_DESTINO', account_code: '2011102' },
        { role_code: 'ALMACEN_ORIGEN', account_code: '2011101' },
      ]);

      await serviceConAsiento.createTransfer(companyId, {
        fromWarehouseCode: 'ALM-01', toWarehouseCode: 'ALM-02', transferNumber: 'TRF-001',
        items: [{ sku: 'SKU-1', quantity: 4 }],
      });

      expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({
        sourceModule: 'INVENTORY',
        lines: expect.arrayContaining([
          expect.objectContaining({ accountCode: '2011102', debitAmount: 200 }),
          expect.objectContaining({ accountCode: '2011101', creditAmount: 200 }),
        ]),
      }));
    });
  });

  describe('createAdjustment', () => {
    it('valida duplicidad de SKU y número de ajuste', async () => {
      await expect(
        service.createAdjustment(companyId, {
          warehouseCode: 'ALM-01',
          type: 'ENTRADA',
          reason: 'Conteo',
          items: [
            { sku: 'SKU-1', quantity: 1 },
            { sku: 'SKU-1', quantity: 2 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      mockPrisma.inventoryAdjustment.findFirst.mockResolvedValue({ id: 'adj-dup' });
      await expect(
        service.createAdjustment(companyId, {
          warehouseCode: 'ALM-01',
          adjustmentNumber: 'AJU-001',
          type: 'ENTRADA',
          reason: 'Conteo',
          items: [{ sku: 'SKU-1', quantity: 1 }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('valida stock insuficiente en ajuste de SALIDA', async () => {
      mockPrisma.inventoryAdjustment.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
      mockPrisma.inventoryProduct.findFirst.mockResolvedValue({ id: 'p-1', is_inventory: true });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({ current_stock: 1 });

      await expect(
        service.createAdjustment(companyId, {
          warehouseCode: 'ALM-01',
          type: 'SALIDA',
          reason: 'Merma',
          items: [{ sku: 'SKU-1', quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ejecuta ajuste de ENTRADA exitosamente', async () => {
      mockPrisma.inventoryAdjustment.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
      mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
        id: 'p-1',
        sku: 'SKU-1',
        description: 'Item 1',
        is_inventory: true,
      });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        current_stock: 10,
        average_unit_cost: 20,
        total_inventory_value: 200,
      });

      mockPrisma.inventoryAdjustment.create.mockResolvedValue({
        id: 'adj-new',
        status: 'APLICADO',
      });

      const res = await service.createAdjustment(companyId, {
        warehouseCode: 'ALM-01',
        type: 'ENTRADA',
        reason: 'Sobrante de inventario físico',
        items: [{ sku: 'SKU-1', quantity: 2, unitCost: 20 }],
      });

      expect(res.id).toBe('adj-new');
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.inventoryBalance.upsert).toHaveBeenCalledTimes(1);
    });

    it('rechaza productos de tipo servicio y genera asientos contables en ajustes ENTRADA (201/759) y SALIDA (659/201)', async () => {
      mockPrisma.inventoryAdjustment.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
      mockPrisma.inventoryProduct.findFirst.mockResolvedValueOnce({
        id: 'p-srv',
        sku: 'SRV-1',
        is_inventory: false,
      });

      await expect(
        service.createAdjustment(companyId, {
          warehouseCode: 'ALM-01',
          type: 'ENTRADA',
          reason: 'Prueba',
          items: [{ sku: 'SRV-1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);

      const accounting = { execute: jest.fn().mockResolvedValue({ id: 'ent-1' }) };
      const svcAccounting = new InventoryTransferService(mockPrisma, accounting as never);
      mockPrisma.inventoryProduct.findFirst.mockResolvedValue({
        id: 'p-1',
        sku: 'SKU-1',
        description: 'Item 1',
        is_inventory: true,
      });
      mockPrisma.inventoryBalance.findUnique.mockResolvedValue({
        current_stock: 10,
        average_unit_cost: 20,
        total_inventory_value: 200,
      });
      mockPrisma.inventoryAdjustment.create
        .mockResolvedValueOnce({
          id: 'adj-in',
          adjustment_number: 'AJU-IN',
          adjustment_date: new Date('2026-11-06'),
          warehouse_code: 'ALM-01',
          type: 'ENTRADA',
          reason: 'Sobrante',
        })
        .mockResolvedValueOnce({
          id: 'adj-out',
          adjustment_number: 'AJU-OUT',
          adjustment_date: new Date('2026-11-06'),
          warehouse_code: 'ALM-01',
          type: 'SALIDA',
          reason: 'Merma',
        });

      await svcAccounting.createAdjustment(companyId, {
        warehouseCode: 'ALM-01',
        adjustmentNumber: 'AJU-IN',
        type: 'ENTRADA',
        reason: 'Sobrante',
        items: [{ sku: 'SKU-1', quantity: 2, unitCost: 20 }],
      });
      expect(accounting.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({ accountCode: '201', debitAmount: 40 }),
            expect.objectContaining({ accountCode: '759', creditAmount: 40 }),
          ]),
        }),
      );

      await svcAccounting.createAdjustment(companyId, {
        warehouseCode: 'ALM-01',
        adjustmentNumber: 'AJU-OUT',
        type: 'SALIDA',
        reason: 'Merma',
        items: [{ sku: 'SKU-1', quantity: 3 }],
      });
      expect(accounting.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({ accountCode: '659', debitAmount: 60 }),
            expect.objectContaining({ accountCode: '201', creditAmount: 60 }),
          ]),
        }),
      );
    });
  });
});

