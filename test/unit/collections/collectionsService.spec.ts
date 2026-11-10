import { BadRequestException } from '@nestjs/common';
import { CollectionsService } from '../../../src/modules/collections/application/services/collectionsService';

describe('CollectionsService', () => {
  it('registra cobro y asiento 10/12', async () => {
    const prisma = {
      collection: { create: jest.fn().mockResolvedValue({ id: 'c1', customer_name: 'Cliente' }) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([{ line_order: 1, account_code: '1041' }, { line_order: 2, account_code: '12121' }]) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new CollectionsService(prisma as never, accounting as never);
    await expect(service.create('co1', { customerName: 'Cliente', amount: 118 })).resolves.toMatchObject({ id: 'c1' });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceModule: 'COLLECTIONS', lines: expect.arrayContaining([expect.objectContaining({ accountCode: '1041', debitAmount: 118 })]) }));
  });

  it('rechaza monto inválido y falta de reglas', async () => {
    const prisma = { collection: { create: jest.fn() }, accountingRule: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new CollectionsService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.create('co1', { customerName: 'Cliente', amount: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('co1', { customerName: 'Cliente', amount: 10 })).rejects.toThrow('No hay reglas contables para COBRO');
  });
});
