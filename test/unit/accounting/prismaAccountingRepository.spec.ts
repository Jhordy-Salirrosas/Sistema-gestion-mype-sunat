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
      prismaMock.accountingEntry.count.mockResolvedValue(0);

      const result = await repository.getNextEntryNumber('company-1', '2026-03');

      expect(result).toBe(1);
      expect(prismaMock.accountingEntry.count).toHaveBeenCalledWith({
        where: {
          company_id: 'company-1',
          period: '2026-03',
        },
      });
    });

    it('debe retornar el correlativo siguiente si ya existen asientos', async () => {
      prismaMock.accountingEntry.count.mockResolvedValue(15);

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
      expect(prismaMock.accountingEntry.create).toHaveBeenCalled();
    });
  });
});