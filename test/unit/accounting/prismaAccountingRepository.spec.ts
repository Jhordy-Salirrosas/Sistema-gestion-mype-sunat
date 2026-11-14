import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { PrismaService } from '../../../src/database/prismaService';

describe('PrismaAccountingRepository', () => {
  let repository: PrismaAccountingRepository;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      accountingEntry: {
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    repository = new PrismaAccountingRepository(prismaMock as unknown as PrismaService);
  });

  describe('getNextEntryNumber', () => {
    it('debe retornar 1 si no existen asientos previos para el periodo', async () => {
      prismaMock.accountingEntry.findFirst.mockResolvedValue(null);

      const result = await repository.getNextEntryNumber('company-1', '2026-03');

      expect(result).toBe(1);
      expect(prismaMock.accountingEntry.findFirst).toHaveBeenCalledWith({
        where: {
          company_id: 'company-1',
          period: '2026-03',
        },
        orderBy: { entry_number: 'desc' },
        select: { entry_number: true },
      });
    });

    it('debe retornar el correlativo siguiente si ya existen asientos', async () => {
      prismaMock.accountingEntry.findFirst.mockResolvedValue({ entry_number: 15 });

      const result = await repository.getNextEntryNumber('company-1', '2026-03');

      expect(result).toBe(16);
    });
  });

  describe('saveEntry', () => {
    it('debe registrar el asiento contable', async () => {
      const mockData: any = {
        companyId: 'company-1',
        period: '2026-03',
        entryNumber: 1,
        entryDate: new Date('2026-03-10'),
        glosa: 'Asiento test',
        sourceModule: 'INVOICES',
        lines: [],
      };

      prismaMock.accountingEntry.create.mockResolvedValue({
        id: 'entry-uuid-1',
        ...mockData,
      });

      const result = await repository.saveEntry(mockData);

      expect(result).toBeDefined();
      expect(result.id).toBe('entry-uuid-1');
      expect(result).not.toBe(mockData);
      expect(result.getTotalDebit()).toBe(0);
      expect(prismaMock.accountingEntry.create).toHaveBeenCalled();
    });
  });

  describe('findByIdempotencyKey', () => {    it('devuelve el asiento existente con sus líneas', async () => {
      prismaMock.accountingEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
        company_id: 'company-1',
        period: '2026-11',
        entry_number: 3,
        entry_date: new Date('2026-11-06'),
        glosa: 'Asiento offline',
        source_module: 'MANUAL',
        source_reference_id: null,
        idempotency_key: 'offline-op-1',
        lines: [
          {
            line_order: 1,
            account_code: '12121',
            account_name: 'CxC',
            debit_amount: 118,
            credit_amount: 0,
          },
        ],
      });

      const result = await repository.findByIdempotencyKey('company-1', 'offline-op-1');

      expect(result?.idempotencyKey).toBe('offline-op-1');
      expect(result?.lines).toHaveLength(1);
      expect(prismaMock.accountingEntry.findFirst).toHaveBeenCalledWith({
        where: { company_id: 'company-1', idempotency_key: 'offline-op-1' },
        include: { lines: true },
      });
    });

    it('devuelve null si la clave no existe', async () => {
      prismaMock.accountingEntry.findFirst.mockResolvedValue(null);
      await expect(repository.findByIdempotencyKey('company-1', 'no-existe')).resolves.toBeNull();
    });
  });

  describe('findLedgerMovementsByAccounts', () => {
    const asiento = (codigos: string[]) => ({
      id: 'e1',
      entry_number: 1,
      entry_date: new Date('2026-11-05'),
      glosa: 'Cobro',
      source_module: 'COLLECTIONS',
      lines: codigos.map((code, i) => ({
        line_order: i + 1,
        account_code: code,
        account_name: code,
        debit_amount: 100,
        credit_amount: 0,
      })),
    });

    it('devuelve solo las líneas de las cuentas pedidas', async () => {
      prismaMock.accountingEntry.findMany.mockResolvedValue([asiento(['1041', '1042', '12121'])]);

      const r = await repository.findLedgerMovementsByAccounts('c1', '2026-11', ['1041', '1042']);

      expect(r.map((m) => m.accountCode)).toEqual(['1041', '1042']);
      expect(r).toHaveLength(2);
    });

    it('no consulta si no hay cuentas', async () => {
      await expect(repository.findLedgerMovementsByAccounts('c1', '2026-11', [])).resolves.toEqual([]);
      expect(prismaMock.accountingEntry.findMany).not.toHaveBeenCalled();
    });

    it('delega findLedgerMovements en la versión multcuenta', async () => {
      prismaMock.accountingEntry.findMany.mockResolvedValue([asiento(['12121'])]);
      const r = await repository.findLedgerMovements('c1', '2026-11', '12121');
      expect(r).toHaveLength(1);
    });

    it('suma el saldo de apertura de todas las cuentas', async () => {
      prismaMock.accountingEntry.findMany.mockResolvedValue([
        { ...asiento(['1041', '1042']), lines: [
          { account_code: '1041', debit_amount: 100, credit_amount: 0 },
          { account_code: '1042', debit_amount: 0, credit_amount: 40 },
          { account_code: '12121', debit_amount: 500, credit_amount: 0 },
        ] },
      ]);

      const saldo = await repository.findLedgerOpeningBalanceByAccounts('c1', '2026-11', ['1041', '1042']);

      expect(saldo).toBe(60);
    });
  });
});
