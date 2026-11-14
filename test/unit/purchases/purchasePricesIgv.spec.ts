import { PurchasesService } from '../../../src/modules/purchases/application/services/purchasesService';

describe('PurchasesService - precios con IGV', () => {
  it('convierte precio final a costo neto y calcula IGV', async () => {
    const prisma: any = {
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      inventoryWarehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', warehouse_code: 'ALM-01' }) },
      nationalPurchase: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ ...data, id: 'p1', items: data.items.create.map((i: any, n: number) => ({ id: `i${n}`, ...i })) })),
      },
      businessPartner: { findFirst: jest.fn().mockResolvedValue(null) },
      inventoryProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'prod1', sku: 'SKU1', description: 'Producto', is_inventory: true, sunat_unit_code: 'NIU' }) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PurchasesService(prisma as never);
    const result = await service.createPurchase('c1', {
      supplierDocNumber: '20100070970', supplierName: 'Proveedor', documentTypeCode: '01', documentSerial: 'F001', documentNumber: '1',
      issueDate: '2026-11-14', pricesIncludeIgv: true, items: [{ sku: 'SKU1', quantity: 2, unitCost: 118 }],
    });
    expect(result.netAmount).toBe(200);
    expect(result.igvAmount).toBe(36);
    expect(result.totalAmount).toBe(236);
    expect(prisma.nationalPurchase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ prices_include_igv: true, net_amount: 200, igv_amount: 36, total_amount: 236 }) }));
  });
});
