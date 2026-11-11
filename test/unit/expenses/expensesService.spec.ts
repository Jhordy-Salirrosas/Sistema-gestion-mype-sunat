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
    await expect(service.create('c1', base)).rejects.toThrow('Las reglas GASTO están incompletas');
  });

  it('registra pago total del gasto y su asiento', async () => {
    const prisma = {
      expense: { findFirst: jest.fn().mockResolvedValue({ id: 'g1', total_amount: 118, paid_amount: 0, status: 'REGISTRADO', supplier_name: 'Proveedor', description: 'Luz' }), update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      treasuryMovement: { create: jest.fn().mockResolvedValue({ id: 'mov-1' }) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([{ line_order: 1, account_code: '42121' }, { line_order: 2, account_code: '1041' }]) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new ExpensesService(prisma as never, accounting as never);
    await expect(service.pay('c1', 'g1', {})).resolves.toMatchObject({ status: 'PAGADO', amount: 118 });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceModule: 'EXPENSES', lines: expect.arrayContaining([expect.objectContaining({ accountCode: '42121', debitAmount: 118 })]) }));
  });

  it('lista pagos y valida gasto inexistente/saldo', async () => {
    const prisma = {
      expense: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'g1' }).mockResolvedValueOnce(null) },
      treasuryMovement: { findMany: jest.fn().mockResolvedValue([{ id: 'm1', movement_date: new Date('2026-11-10'), amount: 50, payment_method: 'TRANSFERENCIA', bank_name: 'BCP', concept: 'Pago' }]) },
    };
    const service = new ExpensesService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.listPayments('c1', 'g1')).resolves.toEqual([{ id: 'm1', date: new Date('2026-11-10'), amount: 50, paymentMethod: 'TRANSFERENCIA', bankName: 'BCP', concept: 'Pago' }]);
    await expect(service.listPayments('c1', 'no')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza pago mayor al saldo y gasto ya pagado', async () => {
    const prisma = { expense: { findFirst: jest.fn().mockResolvedValue({ id: 'g1', total_amount: 100, paid_amount: 0, status: 'REGISTRADO' }) } };
    const service = new ExpensesService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.pay('c1', 'g1', { amount: 200 })).rejects.toBeInstanceOf(BadRequestException);
    prisma.expense.findFirst.mockResolvedValue({ id: 'g1', total_amount: 100, paid_amount: 0, status: 'PAGADO' });
    await expect(service.pay('c1', 'g1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('anula gasto sin pagos con contra-asiento', async () => {
    const prisma = {
      expense: { findFirst: jest.fn().mockResolvedValue({ id: 'g1', description: 'Luz', paid_amount: 0, status: 'REGISTRADO' }), update: jest.fn().mockResolvedValue({ id: 'g1', status: 'ANULADO' }) },
      accountingEntry: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'e1', lines: [{ account_code: '63111', account_name: 'Gasto', debit_amount: 100, credit_amount: 0 }, { account_code: '42121', account_name: 'CxP', debit_amount: 0, credit_amount: 100 }] }).mockResolvedValueOnce(null) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new ExpensesService(prisma as never, accounting as never);
    await expect(service.annul('c1', 'g1')).resolves.toMatchObject({ status: 'ANULADO' });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceReferenceId: 'ANUL-g1', lines: expect.arrayContaining([expect.objectContaining({ accountCode: '42121', debitAmount: 100 })]) }));
  });

  it('anula gasto pagado revirtiendo tesorería y asientos de pago', async () => {
    const lineas = [{ account_code: '63111', account_name: 'Gasto', debit_amount: 100, credit_amount: 0 }, { account_code: '42121', account_name: 'CxP', debit_amount: 0, credit_amount: 100 }];
    const prisma = {
      expense: { findFirst: jest.fn().mockResolvedValue({ id: 'g1', description: 'Luz', document_number: 'F001-1', supplier_name: 'Proveedor', paid_amount: 10, status: 'PAGO_PARCIAL' }), update: jest.fn().mockResolvedValue({ id: 'g1', status: 'ANULADO' }) },
      accountingEntry: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'e1', lines: lineas }).mockResolvedValueOnce({ id: 'p1', lines: lineas }).mockResolvedValueOnce(null) },
      treasuryMovement: { findMany: jest.fn().mockResolvedValue([{ id: 'm1', amount: 10, payment_method: 'TRANSFERENCIA', bank_name: 'BCP' }]), create: jest.fn().mockResolvedValue({ id: 'm2' }) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new ExpensesService(prisma as never, accounting as never);
    await expect(service.annul('c1', 'g1')).resolves.toMatchObject({ status: 'ANULADO' });
    expect(prisma.treasuryMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ direction: 'INGRESO', amount: 10 }) }));
    expect(accounting.execute).toHaveBeenCalledTimes(2);
  });
});
