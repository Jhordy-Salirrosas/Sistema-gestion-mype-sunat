import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InventoryPurchasesController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryPurchasesController';
import { InventoryKardexController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryKardexController';
import { InventoryOpeningController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryOpeningController';
import {
  InventoryTransfersController,
  InventoryAdjustmentsController,
} from '../../../src/modules/inventory/infrastructure/controllers/inventoryTransfersController';
import { InventoryStocksController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryStocksController';

describe('Inventory Controllers (Additional Coverage)', () => {
  const companyId = 'comp-100';

  describe('InventoryPurchasesController', () => {
    let controller: InventoryPurchasesController;
    let mockPurchaseService: any;

    beforeEach(() => {
      mockPurchaseService = {
        createPurchase: jest.fn().mockResolvedValue({ id: 'pur-1' }),
        listPurchases: jest.fn().mockResolvedValue([
          {
            id: 'pur-1',
            purchase_number: 'COM-001',
            supplier_doc_number: '20601234567',
            supplier_name: 'Tech SAC',
            document_type_code: '01',
            document_serial: 'F001',
            document_number: '0001',
            issue_date: new Date('2026-05-01'),
            warehouse_code: 'ALM-01',
            net_amount: 1000,
            igv_amount: 180,
            total_amount: 1180,
            status: 'REGISTRADA',
            notes: 'Compra',
            responsible: 'carlos',
            items: [
              {
                id: 'it-1',
                sku: 'LAP-001',
                description: 'Laptop',
                quantity: 1,
                unit_cost: 1000,
                subtotal: 1000,
                igv_amount: 180,
                total_amount: 1180,
              },
            ],
          },
        ]),
        payPurchase: jest.fn().mockResolvedValue({ id: 'pur-1', status: 'PAGADA', amount: 1180 }),
        listPayments: jest.fn().mockResolvedValue([]),
        getPurchaseById: jest.fn().mockResolvedValue({
          id: 'pur-1',
          purchase_number: 'COM-001',
          supplier_doc_number: '20601234567',
          supplier_name: 'Tech SAC',
          document_type_code: '01',
          document_serial: 'F001',
          document_number: '0001',
          issue_date: new Date('2026-05-01'),
          warehouse_code: 'ALM-01',
          net_amount: 1000,
          igv_amount: 180,
          total_amount: 1180,
          status: 'REGISTRADA',
          notes: 'Compra',
          responsible: 'carlos',
          items: [],
        }),
      };
      controller = new InventoryPurchasesController(mockPurchaseService);
    });

    it('valida companyId requerido', async () => {
      await expect(controller.createPurchase({} as any, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.listPurchases(undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.getPurchaseById('1', undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.payPurchase('1', {}, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.listPayments('1', undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('crea, lista y obtiene compras por ID', async () => {
      const created = await controller.createPurchase({} as any, companyId);
      expect(created.id).toBe('pur-1');

      const list = await controller.listPurchases(companyId);
      expect(list.total).toBe(1);
      expect(list.items[0].purchaseNumber).toBe('COM-001');

      const item = await controller.getPurchaseById('pur-1', companyId);
      expect(item.id).toBe('pur-1');

      const pago = await controller.payPurchase('pur-1', { paymentMethod: 'TRANSFERENCIA' }, companyId);
      expect(pago.status).toBe('PAGADA');

      await expect(controller.listPayments('pur-1', companyId)).resolves.toEqual([]);
    });
  });

  describe('InventoryKardexController', () => {
    let controller: InventoryKardexController;
    let mockKardexService: any;

    beforeEach(() => {
      mockKardexService = {
        getKardex: jest.fn().mockResolvedValue({ movements: [] }),
        getCashAndBanks: jest.fn().mockResolvedValue({ items: [] }),
        getConsolidated: jest.fn().mockResolvedValue({ products: [] }),
      };
      controller = new InventoryKardexController(mockKardexService);
    });

    it('valida companyId requerido', () => {
      expect(() => controller.getKardex(undefined)).toThrow(UnauthorizedException);
      expect(() => controller.getCashAndBanks(undefined)).toThrow(UnauthorizedException);
      expect(() => controller.getConsolidated(undefined)).toThrow(UnauthorizedException);
    });

    it('delega en getKardex, getCashAndBanks y getConsolidated', async () => {
      await controller.getKardex(companyId, 'SKU-1', 'ALM-01', '2026-01-01', '2026-01-31', '01', '01');
      await controller.getCashAndBanks(companyId, '2026-01-01', '2026-01-31', 'INGRESO');
      await controller.getConsolidated(companyId);

      expect(mockKardexService.getKardex).toHaveBeenCalled();
      expect(mockKardexService.getCashAndBanks).toHaveBeenCalled();
      expect(mockKardexService.getConsolidated).toHaveBeenCalledWith(companyId);
    });
  });

  describe('InventoryOpeningController', () => {
    let controller: InventoryOpeningController;
    let mockOpeningService: any;

    beforeEach(() => {
      mockOpeningService = {
        create: jest.fn().mockResolvedValue({ warehouseCode: 'ALM-01' }),
      };
      controller = new InventoryOpeningController(mockOpeningService);
    });

    it('valida companyId y delega creación de apertura', async () => {
      expect(() => controller.create({} as any, undefined)).toThrow(UnauthorizedException);
      const res = await controller.create({} as any, companyId);
      expect(res.warehouseCode).toBe('ALM-01');
    });
  });

  describe('InventoryTransfersController & Adjustments', () => {
    let trfController: InventoryTransfersController;
    let adjController: InventoryAdjustmentsController;
    let mockService: any;

    beforeEach(() => {
      mockService = {
        listTransfers: jest.fn().mockResolvedValue([]),
        createTransfer: jest.fn().mockResolvedValue({ id: 'trf-1' }),
        listAdjustments: jest.fn().mockResolvedValue([]),
        createAdjustment: jest.fn().mockResolvedValue({ id: 'adj-1' }),
      };
      trfController = new InventoryTransfersController(mockService);
      adjController = new InventoryAdjustmentsController(mockService);
    });

    it('valida companyId y delega transferencias', async () => {
      expect(() => trfController.list(undefined)).toThrow(UnauthorizedException);
      expect(() => trfController.create({} as any, undefined)).toThrow(UnauthorizedException);

      await trfController.list(companyId);
      await trfController.create({} as any, companyId);
      expect(mockService.listTransfers).toHaveBeenCalledWith(companyId);
      expect(mockService.createTransfer).toHaveBeenCalledWith(companyId, {});
    });

    it('valida companyId y delega ajustes', async () => {
      expect(() => adjController.list(undefined)).toThrow(UnauthorizedException);
      expect(() => adjController.create({} as any, undefined)).toThrow(UnauthorizedException);

      await adjController.list(companyId);
      await adjController.create({} as any, companyId);
      expect(mockService.listAdjustments).toHaveBeenCalledWith(companyId);
      expect(mockService.createAdjustment).toHaveBeenCalledWith(companyId, {});
    });
  });

  describe('InventoryStocksController - CRUD Almacenes y Productos', () => {
    let controller: InventoryStocksController;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        inventoryWarehouse: {
          findMany: jest.fn().mockResolvedValue([{ warehouse_code: 'ALM-01' }]),
        },
        inventoryProduct: {
          create: jest.fn().mockResolvedValue({ id: 'p-1', sku: 'SKU-1' }),
          findFirst: jest.fn(),
          update: jest.fn().mockResolvedValue({ id: 'p-1', description: 'Updated' }),
          delete: jest.fn().mockResolvedValue({ id: 'p-1' }),
        },
        inventoryMovement: {
          count: jest.fn(),
        },
        inventoryBalance: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      controller = new InventoryStocksController(
        { execute: jest.fn() } as any,
        { execute: jest.fn() } as any,
        {} as any,
        mockPrisma,
      );
    });

    it('lista almacenes del usuario', async () => {
      await expect(controller.listWarehouses(undefined)).rejects.toThrow(UnauthorizedException);
      const list = await controller.listWarehouses(companyId);
      expect(list.length).toBe(1);
    });

    it('obtiene producto por SKU o lanza NotFoundException', async () => {
      await expect(controller.getProductBySku('SKU-1', undefined)).rejects.toThrow(UnauthorizedException);

      mockPrisma.inventoryProduct.findFirst.mockResolvedValueOnce(null);
      await expect(controller.getProductBySku('SKU-NON', companyId)).rejects.toThrow(NotFoundException);

      mockPrisma.inventoryProduct.findFirst.mockResolvedValueOnce({ id: 'p-1', sku: 'SKU-1' });
      const prod = await controller.getProductBySku('SKU-1', companyId);
      expect(prod.sku).toBe('SKU-1');
    });

    it('actualiza producto por SKU o lanza NotFoundException', async () => {
      await expect(controller.updateProduct('SKU-1', {}, undefined)).rejects.toThrow(UnauthorizedException);

      mockPrisma.inventoryProduct.findFirst.mockResolvedValueOnce(null);
      await expect(controller.updateProduct('SKU-NON', {}, companyId)).rejects.toThrow(NotFoundException);

      mockPrisma.inventoryProduct.findFirst.mockResolvedValueOnce({ id: 'p-1', sku: 'SKU-1' });
      const updated = await controller.updateProduct('SKU-1', { description: 'Updated' }, companyId);
      expect(updated.description).toBe('Updated');
    });

    it('inactiva producto si tiene movimientos y elimina físicamente si tiene 0 movimientos', async () => {
      await expect(controller.deleteProduct('SKU-1', undefined)).rejects.toThrow(UnauthorizedException);

      mockPrisma.inventoryProduct.findFirst.mockResolvedValueOnce(null);
      await expect(controller.deleteProduct('SKU-NON', companyId)).rejects.toThrow(NotFoundException);

      // Caso 1: Tiene movimientos (> 0) -> se inactiva
      mockPrisma.inventoryProduct.findFirst.mockResolvedValueOnce({ id: 'p-1', sku: 'SKU-1' });
      mockPrisma.inventoryMovement.count.mockResolvedValueOnce(5);
      const resDeactivated = await controller.deleteProduct('SKU-1', companyId);
      expect(resDeactivated.action).toBe('DEACTIVATED');

      // Caso 2: 0 movimientos -> eliminación física
      mockPrisma.inventoryProduct.findFirst.mockResolvedValueOnce({ id: 'p-1', sku: 'SKU-1' });
      mockPrisma.inventoryMovement.count.mockResolvedValueOnce(0);
      const resDeleted = await controller.deleteProduct('SKU-1', companyId);
      expect(resDeleted.action).toBe('DELETED');
    });
  });
});

