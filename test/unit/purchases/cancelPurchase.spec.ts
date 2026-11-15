import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchasesService } from '../../../src/modules/purchases/application/services/purchasesService';

const purchase = (over: Record<string, any> = {}) => ({ id: 'p1', company_id: 'c1', purchase_number: 'COM-1', supplier_name: 'Proveedor', document_serial: 'F001', document_number: '1', total_amount: 118, net_amount: 100, igv_amount: 18, paid_amount: 0, status: 'REGISTRADA', reception_status: 'PENDIENTE', items: [], ...over });

function setup(initial = purchase()) {
  const prisma: any = {
    nationalPurchase: { findFirst: jest.fn().mockResolvedValue(initial), update: jest.fn(async ({ data }: any) => ({ ...initial, ...data })) },
    accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    accountingRule: { findMany: jest.fn() },
  };
  return { prisma, service: new PurchasesService(prisma as never) };
}

describe('PurchasesService - anulación', () => {
  it('anula una compra no recibida y sin pagos', async () => {
    const { prisma, service } = setup();
    await expect(service.cancelPurchase('c1', 'p1')).resolves.toMatchObject({ status: 'ANULADA' });
    expect(prisma.nationalPurchase.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ANULADA' } }));
  });

  it('rechaza compra inexistente, pagada o recibida', async () => {
    const no = setup(); no.prisma.nationalPurchase.findFirst.mockResolvedValue(null);
    await expect(no.service.cancelPurchase('c1', 'p1')).rejects.toBeInstanceOf(NotFoundException);
    const pagada = setup(purchase({ paid_amount: 10 }));
    await expect(pagada.service.cancelPurchase('c1', 'p1')).rejects.toBeInstanceOf(BadRequestException);
    const recibida = setup(purchase({ reception_status: 'RECIBIDA' }));
    await expect(recibida.service.cancelPurchase('c1', 'p1')).rejects.toThrow('recibida');
  });

  it('revierte el asiento de compra cuando existe', async () => {
    const { prisma } = setup();
    prisma.accountingEntry.findFirst.mockResolvedValue({ id: 'e1' });
    prisma.accountingRule.findMany.mockResolvedValue([{ line_order: 1, account_code: '601' }, { line_order: 2, account_code: '40111' }, { line_order: 3, account_code: '421' }]);
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new PurchasesService(prisma as never, accounting as never);
    await service.cancelPurchase('c1', 'p1');
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceModule: 'PURCHASES_CANCEL' }));
  });
});
