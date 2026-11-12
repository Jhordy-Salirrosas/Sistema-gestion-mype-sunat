import { UnauthorizedException } from '@nestjs/common';
import { PurchasesController } from '../../../src/modules/purchases/infrastructure/controllers/purchasesController';

describe('PurchasesController', () => {
  const companyId = 'comp-100';
  let controller: PurchasesController;
  let mockPurchasesService: any;

  const samplePurchase = {
    id: 'pur-1',
    purchase_number: 'COM-001',
    supplier_doc_number: '20601234567',
    supplier_name: 'Aceros S.A.',
    document_type_code: '01',
    document_serial: 'F001',
    document_number: '00045',
    issue_date: new Date('2026-11-01'),
    warehouse_code: 'ALM-01',
    currency_code: 'USD',
    exchange_rate: 3.75,
    net_amount: 1000,
    igv_amount: 180,
    total_amount: 1180,
    paid_amount: 500,
    status: 'PARCIAL',
    notes: 'Compra nacional',
    responsible: 'ana',
    items: [
      {
        id: 'it-1',
        sku: 'ACE-01',
        description: 'Varilla',
        quantity: 10,
        unit_cost: 100,
        subtotal: 1000,
        igv_amount: 180,
        total_amount: 1180,
      },
    ],
  };

  beforeEach(() => {
    mockPurchasesService = {
      createPurchase: jest.fn().mockResolvedValue({ id: 'pur-1' }),
      listPayments: jest.fn().mockResolvedValue([{ id: 'pay-1', amount: 500 }]),
      payPurchase: jest.fn().mockResolvedValue({ id: 'pur-1', status: 'PAGADA' }),
      listPayables: jest.fn().mockResolvedValue([{ id: 'pur-1', pendingAmount: 680 }]),
      createManualPayable: jest.fn().mockResolvedValue({ id: 'cxp-1' }),
      listPurchases: jest.fn().mockResolvedValue([samplePurchase]),
      getPurchaseById: jest.fn().mockResolvedValue(samplePurchase),
    };
    controller = new PurchasesController(mockPurchasesService);
  });

  it('rechaza peticiones sin companyId autenticado', async () => {
    await expect(controller.createPurchase({} as any, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.listPayments('pur-1', undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.payPurchase('pur-1', {}, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.listPayables(undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.createManualPayable({} as any, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.listPurchases(undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getPurchaseById('pur-1', undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('delega creación, pagos, cuentas por pagar y listado/detalle extendido', async () => {
    expect(await controller.createPurchase({} as any, companyId)).toEqual({ id: 'pur-1' });
    expect(await controller.listPayments('pur-1', companyId)).toEqual([{ id: 'pay-1', amount: 500 }]);
    expect(await controller.payPurchase('pur-1', { amount: 680 }, companyId)).toEqual({
      id: 'pur-1',
      status: 'PAGADA',
    });
    expect(await controller.listPayables(companyId)).toEqual([{ id: 'pur-1', pendingAmount: 680 }]);
    expect(await controller.createManualPayable({ supplierName: 'Proveedor', supplierDocNumber: '20100070970', description: 'Servicio', amount: 100 }, companyId)).toEqual({ id: 'cxp-1' });

    const list = await controller.listPurchases(companyId);
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({
      id: 'pur-1',
      currencyCode: 'USD',
      exchangeRate: 3.75,
      paidAmount: 500,
      pendingAmount: 680,
      itemsCount: 1,
    });

    const detail = await controller.getPurchaseById('pur-1', companyId);
    expect(detail).toMatchObject({
      id: 'pur-1',
      currencyCode: 'USD',
      exchangeRate: 3.75,
      paidAmount: 500,
      pendingAmount: 680,
    });
    expect((detail as any).itemsCount).toBeUndefined();
  });
});

