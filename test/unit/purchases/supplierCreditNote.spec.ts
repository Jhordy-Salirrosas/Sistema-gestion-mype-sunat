import { BadRequestException } from '@nestjs/common';
import { PurchasesService } from '../../../src/modules/purchases/application/services/purchasesService';

const purchase = { id: 'p1', company_id: 'c1', supplier_name: 'Proveedor', total_amount: 118, credit_amount: 0, paid_amount: 0, status: 'REGISTRADA', items: [] };
function setup() {
  const prisma: any = {
    nationalPurchase: { findFirst: jest.fn().mockResolvedValue(purchase), update: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(purchase) },
    supplierCreditNote: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }: any) => ({ id: 'n1', ...data })), findMany: jest.fn().mockResolvedValue([]) },
    accountingRule: { findMany: jest.fn().mockResolvedValue([{ line_order: 1, account_code: '601' }, { line_order: 2, account_code: '40111' }, { line_order: 3, account_code: '421' }]) },
  };
  const accounting = { execute: jest.fn().mockResolvedValue({}) };
  return { prisma, accounting, service: new PurchasesService(prisma as never, accounting as never) };
}

describe('PurchasesService - nota de crédito proveedor', () => {
  it('crea nota, reduce CxP y genera reverso contable', async () => {
    const { prisma, accounting, service } = setup();
    const r = await service.createSupplierCreditNote('c1', 'p1', { amount: 59, reason: 'Faltante' });
    expect(r.note.amount).toBe(59);
    expect(prisma.nationalPurchase.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ credit_amount: 59, status: 'PAGO_PARCIAL' }) }));
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceModule: 'SUPPLIER_CREDIT_NOTE' }));
  });

  it('rechaza importe mayor al saldo', async () => {
    const { service } = setup();
    await expect(service.createSupplierCreditNote('c1', 'p1', { amount: 119, reason: 'Faltante' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
