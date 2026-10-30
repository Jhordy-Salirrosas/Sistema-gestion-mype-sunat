import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { PrismaService } from '../../../src/database/prismaService';

describe('PrismaAccountingRepository', () => {
  let repository: PrismaAccountingRepository;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      accountingEntry: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
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
        where: { companyId: 'company-1', period: '2026-03' },
        orderBy: { entryNumber: 'desc' },
      });
    });

    it('debe retornar el correlativo siguiente si ya existen asientos', async () => {
      prismaMock.accountingEntry.findFirst.mockResolvedValue({ entryNumber: 15 });

      const result = await repository.getNextEntryNumber('company-1', '2026-03');

      expect(result).toBe(16);
    });
  });

  describe('saveEntry', () => {
    it('debe crear el asiento contable en la base de datos', async () => {
      const mockEntryData: any = {
        companyId: 'company-1',
        period: '2026-03',
        entryNumber: 1,
        entryDate: new Date('2026-03-10'),
        glosa: 'Asiento test',
        sourceModule: 'INVOICES',
        lines: [
          { lineOrder: 1, accountCode: '1212', accountName: 'Clientes', debitAmount: 100, creditAmount: 0 },
        ],
      };

      prismaMock.accountingEntry.create.mockResolvedValue({
        id: 'entry-uuid-1',
        ...mockEntryData,
      });

      const result = await repository.saveEntry(mockEntryData);

      expect(result).toBeDefined();
      expect(prismaMock.accountingEntry.create).toHaveBeenCalled();
    });
  });
});