import { BadRequestException } from '@nestjs/common';
import { PurchasesService } from '../../../src/modules/purchases/application/services/purchasesService';

const dto = {
  supplierDocNumber: '20100070970', supplierName: 'Proveedor', documentTypeCode: '01',
  documentSerial: 'F001', documentNumber: '1', issueDate: '2026-11-10',
  items: [{ sku: 'SKU-1', quantity: 1, unitCost: 100 }],
} as never;

describe('PurchasesService - reglas COMPRA', () => {
  it('rechaza compra sin reglas COMPRA', async () => {
    const prisma = { accountingRule: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PurchasesService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.createPurchase('c1', dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza compra con reglas incompletas', async () => {
    const prisma = { accountingRule: { findMany: jest.fn().mockResolvedValue([{ line_order: 1, account_code: '601' }]) } };
    const service = new PurchasesService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.createPurchase('c1', dto)).rejects.toThrow('líneas 1 a 3');
  });

  it('no genera asiento si las reglas desaparecen al asentar', async () => {
    const prisma = {
      accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const accounting = { execute: jest.fn() };
    const service = new PurchasesService(prisma as never, accounting as never);
    await (service as any).registrarAsientoCompra('c1', {
      purchaseNumber: 'COM-1', documentSerial: 'F001', documentNumber: '1', supplierName: 'Proveedor',
      netAmount: 100, igvAmount: 18, totalAmount: 118,
    }, new Date('2026-11-10'));
    expect(accounting.execute).not.toHaveBeenCalled();
  });
});
