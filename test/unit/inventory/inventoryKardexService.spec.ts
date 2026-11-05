import { InventoryKardexService } from '../../../src/modules/inventory/application/services/inventoryKardexService';

describe('InventoryKardexService', () => {
  let service: InventoryKardexService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      inventoryProduct: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      inventoryWarehouse: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      inventoryMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      treasuryMovement: {
        findMany: jest.fn(),
        createMany: jest.fn(),
      },
      invoice: {
        findMany: jest.fn(),
      },
      nationalPurchase: {
        findMany: jest.fn(),
      },
      customsDeclaration: {
        findMany: jest.fn(),
      },
    };

    service = new InventoryKardexService(mockPrisma);
  });

  describe('getKardex', () => {
    it('devuelve emptyResponse si el SKU filtrado no existe', async () => {
      mockPrisma.inventoryProduct.findFirst.mockResolvedValue(null);

      const res = await service.getKardex('comp-1', { sku: 'NONEXISTENT' });
      expect(res.movements).toEqual([]);
      expect(res.totals.count).toBe(0);
    });

    it('devuelve emptyResponse si el almacén filtrado no existe', async () => {
      mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue(null);

      const res = await service.getKardex('comp-1', { warehouse: 'ALM-99' });
      expect(res.movements).toEqual([]);
      expect(res.totals.count).toBe(0);
    });

    it('calcula kardex consolidado con saldo inicial anterior y movimientos del periodo', async () => {
      mockPrisma.inventoryProduct.findFirst.mockResolvedValue({ id: 'p-1', sku: 'LAP-001' });
      mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
      mockPrisma.inventoryWarehouse.findMany.mockResolvedValue([
        { id: 'w-1', warehouse_code: 'ALM-01' },
      ]);

      // Movimiento previo (saldo inicial antes de startDate)
      mockPrisma.inventoryMovement.findMany
        .mockResolvedValueOnce([
          {
            product_id: 'p-1',
            warehouse_id: 'w-1',
            resulting_stock: 10,
            resulting_total_value: 20000,
          },
        ]) // previous
        .mockResolvedValueOnce([
          {
            warehouse_id: 'w-1',
            resulting_stock: 5,
            resulting_total_value: 10000,
          },
        ]) // openingInPeriod (tipo 16)
        .mockResolvedValueOnce([
          {
            id: 'mov-1',
            movement_date: new Date('2026-03-10'),
            movement_number: 'MOV-100',
            operation_type_code: '01',
            document_type_code: '01',
            document_serial: 'F001',
            document_number: '00000001',
            direction: 'SALIDA',
            quantity: 2,
            unit_cost: 2000,
            total_cost: 4000,
            resulting_stock: 13,
            resulting_unit_cost: 2000,
            resulting_total_value: 26000,
            warehouse_id: 'w-1',
            source_module: 'INVOICING',
            product: { sku: 'LAP-001', description: 'Laptop', sunat_unit_code: 'NIU' },
            warehouse: { warehouse_code: 'ALM-01' },
          },
          {
            id: 'mov-2',
            movement_date: new Date('2026-03-15'),
            movement_number: 'MOV-101',
            operation_type_code: '21',
            direction: 'ENTRADA',
            quantity: 3,
            unit_cost: 2000,
            total_cost: 6000,
            resulting_stock: 16,
            resulting_unit_cost: 2000,
            resulting_total_value: 32000,
            warehouse_id: 'w-1',
            source_module: 'TRANSFERS',
            product: { sku: 'LAP-001', description: 'Laptop', sunat_unit_code: 'NIU' },
            warehouse: { warehouse_code: 'ALM-01' },
          },
        ]); // rows

      mockPrisma.inventoryMovement.count.mockResolvedValue(2);

      const res = await service.getKardex('comp-1', {
        sku: 'LAP-001',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      expect(res.mode).toBe('CONSOLIDATED');
      expect(res.opening.stock).toBe(15);
      expect(res.totals.exitsQuantity).toBe(2);
      expect(res.totals.exits).toBe(4000);
      expect(res.internalTransfers.count).toBe(1);
      expect(res.movements.length).toBe(2);
    });

    it('calcula kardex en modo WAREHOUSE cuando se especifica almacén', async () => {
      mockPrisma.inventoryWarehouse.findFirst.mockResolvedValue({ id: 'w-1', warehouse_code: 'ALM-01' });
      mockPrisma.inventoryWarehouse.findMany.mockResolvedValue([
        { id: 'w-1', warehouse_code: 'ALM-01' },
      ]);
      mockPrisma.inventoryMovement.findMany
        .mockResolvedValueOnce([]) // openingInPeriod (sin startDate)
        .mockResolvedValueOnce([
          {
            id: 'mov-3',
            movement_date: new Date('2026-04-10'),
            movement_number: 'MOV-103',
            operation_type_code: '02',
            direction: 'ENTRADA',
            quantity: 5,
            unit_cost: 100,
            total_cost: 500,
            resulting_stock: 5,
            resulting_unit_cost: 100,
            resulting_total_value: 500,
            warehouse_id: 'w-1',
            source_module: 'PURCHASES',
            product: { sku: 'PROD-1' },
            warehouse: { warehouse_code: 'ALM-01' },
          },
        ]);
      mockPrisma.inventoryMovement.count.mockResolvedValue(1);

      const res = await service.getKardex('comp-1', { warehouse: 'ALM-01' });
      expect(res.mode).toBe('WAREHOUSE');
      expect(res.totals.entriesQuantity).toBe(5);
      expect(res.final.stock).toBe(5);
    });
  });

  describe('getCashAndBanks', () => {
    it('retorna movimientos existentes en treasuryMovement', async () => {
      mockPrisma.treasuryMovement.findMany.mockResolvedValue([
        {
          id: 'tm-1',
          movement_date: new Date('2026-05-01'),
          direction: 'INGRESO',
          document_reference: 'F001-001',
          counterpart_name: 'Cliente ABC',
          concept: 'Cobro de factura',
          amount: 1180,
          currency_code: 'PEN',
          payment_method: 'TRANSFERENCIA',
          bank_name: 'BCP',
          source_module: 'INVOICES',
        },
        {
          id: 'tm-2',
          movement_date: new Date('2026-05-02'),
          direction: 'EGRESO',
          document_reference: 'F002-001',
          counterpart_name: 'Proveedor XYZ',
          concept: 'Pago compra',
          amount: 500,
          currency_code: 'PEN',
          payment_method: 'TRANSFERENCIA',
          bank_name: 'BBVA',
          source_module: 'PURCHASES',
        },
      ]);

      const res = await service.getCashAndBanks('comp-1', {
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        direction: 'INGRESO',
      });

      expect(res.totals.totalIngresos).toBe(1180);
      expect(res.totals.totalEgresos).toBe(500);
      expect(res.totals.netBalance).toBe(680);
      expect(res.items.length).toBe(2);
    });

    it('sincroniza automáticamente de facturas, compras y aduanas si treasuryMovement está vacío', async () => {
      mockPrisma.treasuryMovement.findMany
        .mockResolvedValueOnce([]) // Primer findMany vacío
        .mockResolvedValueOnce([
          {
            id: 'tm-auto-1',
            movement_date: new Date('2026-05-10'),
            direction: 'INGRESO',
            amount: 118,
            currency_code: 'PEN',
          },
        ]); // Segundo findMany tras auto-sync

      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          serie: 'F001',
          correlativo: 1,
          fecha_emision: new Date('2026-05-10'),
          customer_legal_name: 'Cliente Demo',
          monto_total: 118,
          currency_code: 'PEN',
        },
      ]);

      mockPrisma.nationalPurchase.findMany.mockResolvedValue([
        {
          id: 'pur-1',
          purchase_number: 'COM-001',
          issue_date: new Date('2026-05-11'),
          document_serial: 'E001',
          document_number: '123',
          supplier_name: 'Prov Nacional',
          total_amount: 50,
          currency_code: 'PEN',
        },
      ]);

      mockPrisma.customsDeclaration.findMany.mockResolvedValue([
        {
          id: 'dam-1',
          customs_code: '118',
          declaration_year: 2026,
          regime_code: '10',
          dua_number: '048291',
          created_at: new Date('2026-05-12'),
          total_customs_taxes_pen: 200,
        },
      ]);

      mockPrisma.treasuryMovement.createMany.mockResolvedValue({ count: 3 });

      const res = await service.getCashAndBanks('comp-1', {});
      expect(mockPrisma.treasuryMovement.createMany).toHaveBeenCalled();
      expect(res.items.length).toBe(1);
    });
  });

  describe('getConsolidated', () => {
    it('consolida existencias por producto y almacén', async () => {
      mockPrisma.inventoryProduct.findMany.mockResolvedValue([
        {
          id: 'p-1',
          sku: 'LAP-001',
          description: 'Laptop Gamer',
          sunat_unit_code: 'NIU',
          sunat_type_code: '01',
          balances: [
            {
              current_stock: 10,
              average_unit_cost: 2000,
              total_inventory_value: 20000,
              warehouse: {
                warehouse_code: 'ALM-01',
                description: 'Principal',
              },
            },
            {
              current_stock: 5,
              average_unit_cost: 2000,
              total_inventory_value: 10000,
              warehouse: {
                warehouse_code: 'ALM-02',
                description: 'Secundario',
              },
            },
          ],
        },
      ]);

      const res = await service.getConsolidated('comp-1');
      expect(res.totalProducts).toBe(1);
      expect(res.totalStockGlobal).toBe(15);
      expect(res.totalValueGlobal).toBe(30000);
      expect(res.products[0].totalStock).toBe(15);
      expect(res.products[0].averageUnitCost).toBe(2000);
      expect(res.products[0].warehouses.length).toBe(2);
    });
  });
});

