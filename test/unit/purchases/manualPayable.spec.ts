import { BadRequestException } from '@nestjs/common';
import { PurchasesService } from '../../../src/modules/purchases/application/services/purchasesService';

describe('PurchasesService - CxP manual', () => {
  it('crea CxP manual con asiento GASTO/421', async () => {
    const prisma = {
      accountingRule: { findMany: jest.fn().mockResolvedValue([{ line_order: 1, account_code: '63111' }, { line_order: 3, account_code: '42121' }]) },
      nationalPurchase: { create: jest.fn().mockResolvedValue({ id: 'p1', purchase_number: 'CXP-1' }) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new PurchasesService(prisma as never, accounting as never);
    await expect(service.createManualPayable('c1', { supplierName: 'Proveedor', supplierDocNumber: '20100070970', description: 'Servicio', amount: 100 })).resolves.toMatchObject({ id: 'p1' });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceModule: 'MANUAL_PAYABLE', lines: expect.arrayContaining([expect.objectContaining({ accountCode: '42121', creditAmount: 100 })]) }));
  });

  it('rechaza monto y reglas incompletas', async () => {
    const prisma = { accountingRule: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PurchasesService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.createManualPayable('c1', { supplierName: 'Proveedor', supplierDocNumber: '20100070970', description: 'Servicio', amount: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createManualPayable('c1', { supplierName: 'Proveedor', supplierDocNumber: '20100070970', description: 'Servicio', amount: 10 })).rejects.toThrow('reglas GASTO');
  });
});
