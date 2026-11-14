import { BadRequestException } from '@nestjs/common';
import { CollectionsService } from '../../../src/modules/collections/application/services/collectionsService';

const reglas = [
  { line_order: 1, account_code: '1041' },
  { line_order: 2, account_code: '12121' },
];

const crearPrisma = (over: Record<string, any> = {}) => ({
  collection: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'cb1', customer_name: 'Cliente SAC', invoice_number: null }),
  },
  accountingRule: { findMany: jest.fn().mockResolvedValue(reglas) },
  accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
  collectionDistribution: {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  $transaction: jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  ...over,
});

describe('CollectionsService · distribución', () => {
  it('crea el cobro distribuido entre varias cuentas por cobrar', async () => {
    const prisma = crearPrisma();
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new CollectionsService(prisma as never, accounting as never);

    await service.create('c1', {
      customerName: 'Cliente SAC',
      amount: 100,
      distributions: [
        { accountCode: '12121', amount: 70 },
        { accountCode: '12129', amount: 30 },
      ],
    });

    expect(prisma.collection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          distributions: {
            create: [
              { company_id: 'c1', account_code: '12121', amount: 70, percentage: 70 },
              { company_id: 'c1', account_code: '12129', amount: 30, percentage: 30 },
            ],
          },
        }),
      }),
    );

    const lineas = accounting.execute.mock.calls[0][0].lines;
    expect(lineas).toEqual([
      expect.objectContaining({ accountCode: '1041', debitAmount: 100 }),
      expect.objectContaining({ accountCode: '12121', creditAmount: 70 }),
      expect.objectContaining({ accountCode: '12129', creditAmount: 30 }),
    ]);
  });

  it('sin distribución deja una sola cuenta por cobrar', async () => {
    const prisma = crearPrisma();
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    await new CollectionsService(prisma as never, accounting as never).create('c1', {
      customerName: 'Cliente SAC',
      amount: 50,
    });
    expect(accounting.execute.mock.calls[0][0].lines).toHaveLength(2);
    expect(accounting.execute.mock.calls[0][0].lines[1]).toMatchObject({
      accountCode: '12121',
      creditAmount: 50,
    });
  });

  it('rechaza una distribución que no suma el importe cobrado', async () => {
    const prisma = crearPrisma();
    await expect(
      new CollectionsService(prisma as never, { execute: jest.fn() } as never).create('c1', {
        customerName: 'Cliente SAC',
        amount: 100,
        distributions: [{ accountCode: '12121', amount: 90 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.collection.create).not.toHaveBeenCalled();
  });

  it('redistribuye un cobro sin asiento', async () => {
    const prisma = crearPrisma();
    prisma.collection.findFirst.mockResolvedValue({ id: 'cb1', amount: 100, status: 'REGISTRADO' });
    const service = new CollectionsService(prisma as never, { execute: jest.fn() } as never);
    await expect(
      service.setDistributions('c1', 'cb1', [{ accountCode: '12121', amount: 100 }]),
    ).resolves.toEqual([]);
    expect(prisma.collectionDistribution.createMany).toHaveBeenCalled();
  });

  it('no redistribuye un cobro contabilizado', async () => {
    const prisma = crearPrisma();
    prisma.collection.findFirst.mockResolvedValue({ id: 'cb1', amount: 100, status: 'REGISTRADO' });
    prisma.accountingEntry.findFirst.mockResolvedValue({ id: 'e1' });
    await expect(
      new CollectionsService(prisma as never, { execute: jest.fn() } as never).setDistributions('c1', 'cb1', [
        { accountCode: '12121', amount: 100 },
      ]),
    ).rejects.toThrow('ya está contabilizado');
  });

  it('no redistribuye un cobro anulado', async () => {
    const prisma = crearPrisma();
    prisma.collection.findFirst.mockResolvedValue({ id: 'cb1', amount: 100, status: 'ANULADO' });
    await expect(
      new CollectionsService(prisma as never, { execute: jest.fn() } as never).setDistributions('c1', 'cb1', [
        { accountCode: '12121', amount: 100 },
      ]),
    ).rejects.toThrow('está anulado');
  });
});
