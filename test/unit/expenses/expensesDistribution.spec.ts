import { BadRequestException } from '@nestjs/common';
import { ExpensesService } from '../../../src/modules/expenses/application/services/expensesService';

const reglas = [
  { line_order: 1, account_code: '63111' },
  { line_order: 2, account_code: '40111' },
  { line_order: 3, account_code: '42121' },
];

const crearPrisma = (over: Record<string, any> = {}) => ({
  expense: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'g1', description: 'Flete', supplier_name: 'Transportes SAC' }),
  },
  accountingRule: { findMany: jest.fn().mockResolvedValue(reglas) },
  accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
  expenseDistribution: {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  $transaction: jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  ...over,
});

const dtoBase = {
  description: 'Flete y embalaje',
  supplierName: 'Transportes SAC',
  baseAmount: 100,
  igvAmount: 18,
  totalAmount: 118,
};

describe('ExpensesService · distribución', () => {
  it('crea el gasto con distribución y arma un asiento por cada cuenta', async () => {
    const prisma = crearPrisma();
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new ExpensesService(prisma as never, accounting as never);

    await service.create('c1', {
      ...dtoBase,
      distributions: [
        { accountCode: '63111', amount: 60 },
        { accountCode: '63421', amount: 40 },
      ],
    });

    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          distributions: {
            create: [
              { company_id: 'c1', account_code: '63111', amount: 60, percentage: 60 },
              { company_id: 'c1', account_code: '63421', amount: 40, percentage: 40 },
            ],
          },
        }),
      }),
    );

    const lineas = accounting.execute.mock.calls[0][0].lines;
    expect(lineas).toEqual([
      expect.objectContaining({ accountCode: '63111', debitAmount: 60 }),
      expect.objectContaining({ accountCode: '63421', debitAmount: 40 }),
      expect.objectContaining({ accountCode: '40111', debitAmount: 18 }),
      expect.objectContaining({ accountCode: '42121', creditAmount: 118 }),
    ]);
    const debe = lineas.reduce((s: number, l: any) => s + l.debitAmount, 0);
    const haber = lineas.reduce((s: number, l: any) => s + l.creditAmount, 0);
    expect(debe).toBeCloseTo(haber, 2);
  });

  it('sin distribución mantiene el asiento de una sola cuenta', async () => {
    const prisma = crearPrisma();
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    await new ExpensesService(prisma as never, accounting as never).create('c1', dtoBase);
    expect(accounting.execute.mock.calls[0][0].lines[0]).toMatchObject({
      accountCode: '63111',
      debitAmount: 100,
    });
  });

  it('rechaza una distribución que no suma la base', async () => {
    const prisma = crearPrisma();
    const service = new ExpensesService(prisma as never, { execute: jest.fn() } as never);
    await expect(
      service.create('c1', {
        ...dtoBase,
        distributions: [
          { accountCode: '63111', amount: 60 },
          { accountCode: '63421', amount: 30 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it('omite la línea de IGV cuando el gasto no tiene IGV', async () => {
    const prisma = crearPrisma();
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    await new ExpensesService(prisma as never, accounting as never).create('c1', {
      ...dtoBase,
      igvAmount: 0,
      totalAmount: 100,
    });
    const lineas = accounting.execute.mock.calls[0][0].lines;
    expect(lineas).toHaveLength(2);
    expect(lineas.some((l: any) => l.accountCode === '40111')).toBe(false);
  });

  it('redistribuye un gasto que aún no tiene asiento', async () => {
    const prisma = crearPrisma();
    prisma.expense.findFirst.mockResolvedValue({ id: 'g1', base_amount: 100, status: 'REGISTRADO' });
    prisma.expenseDistribution.findMany.mockResolvedValue([
      { account_code: '63111', amount: 70, percentage: 70 },
      { account_code: '63421', amount: 30, percentage: 30 },
    ]);
    const service = new ExpensesService(prisma as never, { execute: jest.fn() } as never);

    const r = await service.setDistributions('c1', 'g1', [
      { accountCode: '63111', amount: 70 },
      { accountCode: '63421', amount: 30 },
    ]);

    expect(prisma.expenseDistribution.deleteMany).toHaveBeenCalled();
    expect(prisma.expenseDistribution.createMany).toHaveBeenCalledWith({
      data: [
        { expense_id: 'g1', company_id: 'c1', account_code: '63111', amount: 70, percentage: 70 },
        { expense_id: 'g1', company_id: 'c1', account_code: '63421', amount: 30, percentage: 30 },
      ],
    });
    expect(r).toHaveLength(2);
  });

  it('no redistribuye un gasto ya contabilizado', async () => {
    const prisma = crearPrisma();
    prisma.expense.findFirst.mockResolvedValue({ id: 'g1', base_amount: 100, status: 'REGISTRADO' });
    prisma.accountingEntry.findFirst.mockResolvedValue({ id: 'e1' });
    const service = new ExpensesService(prisma as never, { execute: jest.fn() } as never);

    await expect(
      service.setDistributions('c1', 'g1', [{ accountCode: '63111', amount: 100 }]),
    ).rejects.toThrow('ya está contabilizado');
    expect(prisma.expenseDistribution.deleteMany).not.toHaveBeenCalled();
  });

  it('contabiliza un gasto pendiente usando su distribución guardada', async () => {
    const prisma = crearPrisma();
    prisma.expense.findFirst.mockResolvedValue({
      id: 'g1',
      description: 'Flete',
      supplier_name: 'Transportes SAC',
      base_amount: 100,
      igv_amount: 18,
      total_amount: 118,
      expense_date: new Date('2026-11-10T00:00:00Z'),
      status: 'REGISTRADO',
    });
    prisma.expenseDistribution.findMany.mockResolvedValue([
      { account_code: '63111', amount: 100, percentage: 100 },
    ]);
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new ExpensesService(prisma as never, accounting as never);

    await expect(service.post('c1', 'g1')).resolves.toEqual({ id: 'g1', contabilizado: true });
    expect(accounting.execute.mock.calls[0][0].lines[0]).toMatchObject({ accountCode: '63111' });
  });

  it('no contabiliza dos veces el mismo gasto', async () => {
    const prisma = crearPrisma();
    prisma.expense.findFirst.mockResolvedValue({ id: 'g1', status: 'REGISTRADO' });
    prisma.accountingEntry.findFirst.mockResolvedValue({ id: 'e1' });
    await expect(
      new ExpensesService(prisma as never, { execute: jest.fn() } as never).post('c1', 'g1'),
    ).rejects.toThrow('ya tiene asiento contable');
  });

  it('no distribuye un gasto anulado', async () => {
    const prisma = crearPrisma();
    prisma.expense.findFirst.mockResolvedValue({ id: 'g1', base_amount: 100, status: 'ANULADO' });
    await expect(
      new ExpensesService(prisma as never, { execute: jest.fn() } as never).setDistributions('c1', 'g1', [
        { accountCode: '63111', amount: 100 },
      ]),
    ).rejects.toThrow('está anulado');
  });
});
