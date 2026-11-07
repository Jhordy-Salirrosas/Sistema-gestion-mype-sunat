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

  describe('findByIdempotencyKey', () => {
    it('devuelve el asiento existente con sus líneas', async () => {
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
});
