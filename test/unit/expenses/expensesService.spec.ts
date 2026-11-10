import { BadRequestException } from '@nestjs/common';
import { ExpensesService } from '../../../src/modules/expenses/application/services/expensesService';

describe('ExpensesService', () => {
  const base = { description: 'Luz', supplierName: 'Luz del Sur', baseAmount: 100, igvAmount: 18, totalAmount: 118 };
  it('registra gasto y asiento con reglas GASTO', async () => {
    const prisma = {
      expense: { create: jest.fn().mockResolvedValue({ id: 'g1', description: 'Luz', supplier_name: 'Luz del Sur' }) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([
        { line_order: 1, account_code: '63111' }, { line_order: 2, account_code: '40111' }, { line_order: 3, account_code: '42121' },
      ]) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new ExpensesService(prisma as never, accounting as never);
    await expect(service.create('c1', base)).resolves.toMatchObject({ id: 'g1' });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceModule: 'EXPENSES', lines: expect.arrayContaining([expect.objectContaining({ accountCode: '63111', debitAmount: 100 })]),
    }));
  });

  it('rechaza total descuadrado y falta de reglas', async () => {
    const prisma = { expense: { create: jest.fn() }, accountingRule: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ExpensesService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.create('c1', { ...base, totalAmount: 200 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('c1', base)).rejects.toThrow('No hay reglas contables para GASTO');
  });
});
