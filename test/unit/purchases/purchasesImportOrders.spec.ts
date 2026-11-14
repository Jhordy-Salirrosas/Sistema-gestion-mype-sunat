import { NotFoundException } from '@nestjs/common';
import { PurchasesService } from '../../../src/modules/purchases/application/services/purchasesService';

describe('PurchasesService - Import Orders Integration', () => {
  let service: PurchasesService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      nationalPurchase: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      importOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      accountingRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      localExpenseInvoice: {
        create: jest.fn(),
      },
    };

    service = new PurchasesService(prismaMock as any);
  });

  describe('listPurchases', () => {
    it('debe combinar y ordenar compras nacionales y órdenes de importación', async () => {
      const natPurchase = {
        id: 'nat-1',
        company_id: 'c-1',
        purchase_number: 'COM-001',
        issue_date: new Date('2026-11-01'),
        total_amount: 1000,
        items: [],
      };

      const importOrderArrived = {
        id: 'imp-1',
        company_id: 'c-1',
        order_number: 'OC-2026-001',
        issue_date: new Date('2026-11-05'),
        total_fob: 5000,
        total_cif: 5800,
        incoterm: 'FOB',
        current_stage_index: 12,
        status: 'APROBADA',
        supplier_tax_id: 'CN12345',
        supplier_name: 'China Supplier',
        items: [
          {
            id: 'it-1',
            product_code: 'POR-120',
            description: 'Porcelanato',
            quantity: 200,
            unit_price_fob: 25,
            total_fob: 5000,
          },
        ],
      };

      const importOrderPending = {
        id: 'imp-2',
        company_id: 'c-1',
        order_number: 'OC-2026-002',
        issue_date: new Date('2026-11-03'),
        total_fob: 2000,
        total_cif: 0,
        incoterm: 'EXW',
        current_stage_index: 5,
        status: 'EN_PROCESO',
        supplier_country: 'US',
        supplier_name: 'US Supplier',
        items: [],
      };

      prismaMock.nationalPurchase.findMany.mockResolvedValue([natPurchase]);
      prismaMock.importOrder.findMany.mockResolvedValue([importOrderArrived, importOrderPending]);

      const result = await service.listPurchases('c-1');

      expect(result).toHaveLength(3);
      // El más reciente primero: 2026-11-05 (imp-1), luego 2026-11-03 (imp-2), luego 2026-11-01 (nat-1)
      expect(result[0].purchase_number).toBe('OC-2026-001');
      expect(result[0].reception_status).toBe('RECIBIDA');
      expect(result[0].total_amount).toBe(5800);
      expect(result[0].items[0].received_quantity).toBe(200);

      expect(result[1].purchase_number).toBe('OC-2026-002');
      expect(result[1].reception_status).toBe('PENDIENTE');
      expect(result[1].total_amount).toBe(2000);

      expect(result[2].purchase_number).toBe('COM-001');
    });
  });

  describe('getPurchaseById', () => {
    it('debe retornar compra nacional si se encuentra', async () => {
      prismaMock.nationalPurchase.findFirst.mockResolvedValue({
        id: 'nat-1',
        purchase_number: 'COM-001',
      });

      const res = await service.getPurchaseById('c-1', 'nat-1');
      expect(res.purchase_number).toBe('COM-001');
      expect(prismaMock.importOrder.findFirst).not.toHaveBeenCalled();
    });

    it('debe retornar orden de importación mapeada si la compra nacional no existe', async () => {
      prismaMock.nationalPurchase.findFirst.mockResolvedValue(null);
      prismaMock.importOrder.findFirst.mockResolvedValue({
        id: 'imp-1',
        company_id: 'c-1',
        order_number: 'OC-2026-001',
        issue_date: new Date('2026-11-05'),
        total_fob: 5000,
        total_cif: 5800,
        incoterm: 'FOB',
        current_stage_index: 14,
        status: 'APROBADA',
        supplier_name: 'China Supplier',
        items: [
          {
            id: 'it-1',
            product_code: 'POR-120',
            description: 'Porcelanato',
            quantity: 200,
            unit_price_fob: 25,
            total_fob: 5000,
          },
        ],
        documents: [{ id: 'doc-1', file_name: 'proforma.pdf', storage_url: 'http://doc.pdf' }],
      });

      const res = await service.getPurchaseById('c-1', 'imp-1');
      expect(res.purchase_number).toBe('OC-2026-001');
      expect(res.status).toBe('REGISTRADA');
      expect(res.reception_status).toBe('RECIBIDA');
      expect(res.documents).toHaveLength(1);
      expect(res.items[0].received_quantity).toBe(200);
    });

    it('debe lanzar NotFoundException si no existe ni compra nacional ni orden de importación', async () => {
      prismaMock.nationalPurchase.findFirst.mockResolvedValue(null);
      prismaMock.importOrder.findFirst.mockResolvedValue(null);

      await expect(service.getPurchaseById('c-1', 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
