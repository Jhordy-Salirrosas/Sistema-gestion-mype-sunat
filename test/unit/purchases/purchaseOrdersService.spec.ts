import { BadRequestException } from '@nestjs/common';
import { PurchaseOrdersService } from '../../../src/modules/purchases/application/services/purchaseOrdersService';

const order = (over: Record<string, any> = {}) => ({ id: 'o1', company_id: 'c1', order_number: 'OC-2026-0001', supplier_doc_number: '20100070970', supplier_name: 'Proveedor', supplier_id: null, warehouse_code: 'ALM-01', issue_date: new Date('2026-11-15'), expected_date: null, prices_include_igv: true, net_amount: 100, igv_amount: 18, total_amount: 118, status: 'BORRADOR', notes: null, converted_purchase_id: null, items: [{ id: 'i1', sku: 'SKU1', description: 'Producto', quantity: 1, unit_cost: 100, subtotal: 100, igv_amount: 18, total_amount: 118 }], ...over });

function setup(initial = order()) {
  const prisma: any = {
    purchaseOrder: {
      findFirst: jest.fn().mockResolvedValue(initial), findMany: jest.fn().mockResolvedValue([initial]),
      create: jest.fn(async ({ data }: any) => ({ ...initial, ...data, items: data.items.create })), update: jest.fn(async ({ data }: any) => ({ ...initial, ...data })),
    },
    inventoryProduct: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', sku: 'SKU1', description: 'Producto', is_active: true, sunat_unit_code: 'NIU' }) },
  };
  const purchases: any = { createPurchase: jest.fn().mockResolvedValue({ id: 'compra1' }) };
  return { prisma, purchases, service: new PurchaseOrdersService(prisma, purchases) };
}

describe('PurchaseOrdersService', () => {
  it('crea orden y calcula precios con IGV', async () => {
    const { prisma, service } = setup();
    const r = await service.create('c1', { supplierDocNumber: '20100070970', supplierName: 'Proveedor', issueDate: '2026-11-15', pricesIncludeIgv: true, items: [{ sku: 'SKU1', quantity: 2, unitCost: 118 }] });
    expect(r.totalAmount).toBe(236);
    expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ net_amount: 200, igv_amount: 36, total_amount: 236 }) }));
  });

  it('aprueba y anula solo estados válidos', async () => {
    const { service } = setup();
    await expect(service.approve('c1', 'o1')).resolves.toMatchObject({ status: 'APROBADA' });
    await expect(service.cancel('c1', 'o1')).resolves.toMatchObject({ status: 'ANULADA' });
    const convertida = setup(order({ status: 'CONVERTIDA' }));
    await expect(convertida.service.cancel('c1', 'o1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('convierte una orden aprobada en compra', async () => {
    const { purchases, service } = setup(order({ status: 'APROBADA' }));
    const r = await service.convert('c1', 'o1', { documentTypeCode: '01', documentSerial: 'F001', documentNumber: '123' });
    expect(purchases.createPurchase).toHaveBeenCalledWith('c1', expect.objectContaining({ documentSerial: 'F001', documentNumber: '123' }));
    expect(r.purchase).toEqual({ id: 'compra1' });
  });
});
