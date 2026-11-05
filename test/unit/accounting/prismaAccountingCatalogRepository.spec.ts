import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { PrismaService } from '../../../src/database/prismaService';

describe('PrismaAccountingRepository - catálogo y períodos', () => {
  let repository: PrismaAccountingRepository;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      accountingAccount: { findMany: jest.fn() },
      accountingPeriod: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      accountingEntry: { findMany: jest.fn() },
    };
    repository = new PrismaAccountingRepository(prismaMock as unknown as PrismaService);
  });

  it('mapea el catálogo PCGE activo', async () => {
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      {
        code: '1211',
        name: 'Cuentas por cobrar',
        element: 'Activo',
        nature: 'Deudora',
        parent_code: '12',
        level: 4,
        is_active: true,
      },
    ]);

    await expect(repository.findAccounts()).resolves.toEqual([
      {
        code: '1211',
        name: 'Cuentas por cobrar',
        element: 'Activo',
        nature: 'Deudora',
        parentCode: '12',
        level: 4,
        isActive: true,
      },
    ]);
    expect(prismaMock.accountingAccount.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      orderBy: { code: 'asc' },
    });
  });

  it('lista y mapea los períodos de la empresa', async () => {
    prismaMock.accountingPeriod.findMany.mockResolvedValue([
      {
        company_id: 'comp-1',
        period: '2026-11',
        year: 2026,
        month: 11,
        status: 'ABIERTO',
        opened_at: new Date('2026-11-01'),
        closed_at: null,
      },
    ]);

    await expect(repository.findPeriods('comp-1')).resolves.toEqual([
      {
        companyId: 'comp-1',
        period: '2026-11',
        year: 2026,
        month: 11,
        status: 'ABIERTO',
        openedAt: new Date('2026-11-01'),
        closedAt: null,
      },
    ]);
  });

  it('devuelve null cuando el período no existe y mapea cuando existe', async () => {
    prismaMock.accountingPeriod.findUnique.mockResolvedValueOnce(null);
    await expect(repository.findPeriod('comp-1', '2026-11')).resolves.toBeNull();

    prismaMock.accountingPeriod.findUnique.mockResolvedValueOnce({
      company_id: 'comp-1',
      period: '2026-11',
      year: 2026,
      month: 11,
      status: 'CERRADO',
      opened_at: new Date('2026-11-01'),
      closed_at: new Date('2026-11-30'),
    });
    await expect(repository.findPeriod('comp-1', '2026-11')).resolves.toMatchObject({
      status: 'CERRADO',
      companyId: 'comp-1',
    });
  });

  it('abre un período con upsert', async () => {
    prismaMock.accountingPeriod.upsert.mockResolvedValue({
      company_id: 'comp-1',
      period: '2026-11',
      year: 2026,
      month: 11,
      status: 'ABIERTO',
      opened_at: new Date('2026-11-01'),
      closed_at: null,
    });

    await expect(repository.openPeriod('comp-1', 2026, 11)).resolves.toMatchObject({
      period: '2026-11',
      status: 'ABIERTO',
    });
    expect(prismaMock.accountingPeriod.upsert).toHaveBeenCalledWith({
      where: { company_id_period: { company_id: 'comp-1', period: '2026-11' } },
      update: { status: 'ABIERTO', closed_at: null },
      create: {
        company_id: 'comp-1',
        period: '2026-11',
        year: 2026,
        month: 11,
        status: 'ABIERTO',
      },
    });
  });

  it('cierra un período con upsert', async () => {
    prismaMock.accountingPeriod.upsert.mockResolvedValue({
      company_id: 'comp-1',
      period: '2026-11',
      year: 2026,
      month: 11,
      status: 'CERRADO',
      opened_at: new Date('2026-11-01'),
      closed_at: new Date('2026-11-30'),
    });

    await expect(repository.closePeriod('comp-1', '2026-11')).resolves.toMatchObject({
      status: 'CERRADO',
    });
    expect(prismaMock.accountingPeriod.upsert).toHaveBeenCalledWith({
      where: { company_id_period: { company_id: 'comp-1', period: '2026-11' } },
      update: { status: 'CERRADO', closed_at: expect.any(Date) },
      create: {
        company_id: 'comp-1',
        period: '2026-11',
        year: 2026,
        month: 11,
        status: 'CERRADO',
        closed_at: expect.any(Date),
      },
    });
  });

  it('arma los movimientos del libro mayor y las filas del balance', async () => {
    prismaMock.accountingEntry.findMany.mockResolvedValue([
      {
        id: 'e1',
        entry_number: 1,
        entry_date: new Date('2026-11-01'),
        glosa: 'Venta',
        source_module: 'M1_INVOICES',
        lines: [
          { account_code: '1211', account_name: 'CxC', debit_amount: 118, credit_amount: 0 },
          { account_code: '7011', account_name: 'Ventas', debit_amount: 0, credit_amount: 118 },
        ],
      },
    ]);

    await expect(repository.findLedgerMovements('c1', '2026-11', '1211')).resolves.toEqual([
      {
        entryId: 'e1',
        entryNumber: 1,
        entryDate: new Date('2026-11-01'),
        glosa: 'Venta',
        sourceModule: 'M1_INVOICES',
        accountCode: '1211',
        accountName: 'CxC',
        debit: 118,
        credit: 0,
      },
    ]);

    await expect(repository.findTrialBalanceRows('c1', '2026-11')).resolves.toEqual([
      { accountCode: '1211', accountName: 'CxC', debit: 118, credit: 0 },
      { accountCode: '7011', accountName: 'Ventas', debit: 0, credit: 118 },
    ]);
  });
});
