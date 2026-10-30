import { AccountingController } from '../../../src/modules/accounting/infrastructure/controllers/accountingController';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import { ExportPleTxtUseCase } from '../../../src/modules/accounting/application/use-cases/exportPleTxtUseCase';
import { GetAccountingEntriesUseCase } from '../../../src/modules/accounting/application/use-cases/getAccountingEntriesUseCase';
import { AccountingEntryEntity } from '../../../src/modules/accounting/domain/entities/accountingEntryEntity';

describe('AccountingController', () => {
  let controller: AccountingController;
  let generateUseCase: jest.Mocked<GenerateAccountingEntryUseCase>;
  let exportPleUseCase: jest.Mocked<ExportPleTxtUseCase>;
  let getEntriesUseCase: jest.Mocked<GetAccountingEntriesUseCase>;

  beforeEach(() => {
    generateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GenerateAccountingEntryUseCase>;

    exportPleUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ExportPleTxtUseCase>;

    getEntriesUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<GetAccountingEntriesUseCase>;

    controller = new AccountingController(
      generateUseCase,
      exportPleUseCase,
      getEntriesUseCase,
    );
  });

  it('debe delegar la creación de asiento al caso de uso', async () => {
    const mockEntry = new AccountingEntryEntity({
      companyId: 'comp-1',
      period: '2026-03',
      entryNumber: 1,
      entryDate: new Date(),
      glosa: 'Venta',
      sourceModule: 'INVOICES',
      lines: [],
    });

    generateUseCase.execute.mockResolvedValue(mockEntry);

    const dto = {
      companyId: 'comp-1',
      period: '2026-03',
      entryDate: '2026-03-01T00:00:00.000Z',
      glosa: 'Venta',
      sourceModule: 'INVOICES',
      lines: [],
    };

    const result = await controller.createEntry(dto);

    expect(result).toBe(mockEntry);
    expect(generateUseCase.execute).toHaveBeenCalledWith(dto);
  });

  it('debe delegar la exportación PLE al caso de uso', async () => {
    const mockExportResult = {
      fileName: 'LE2010007097020260300050100001111.txt',
      recordsCount: 0,
      totalDebit: 0,
      totalCredit: 0,
      content: '',
    };

    getEntriesUseCase.execute.mockResolvedValue([]);
    exportPleUseCase.execute.mockResolvedValue(mockExportResult);

    const dto = {
      companyId: 'comp-1',
      companyRuc: '20100070970',
      year: 2026,
      month: 3,
      bookCode: '050100',
    };

    const result = await controller.exportPle(dto);

    expect(result).toBe(mockExportResult);
    expect(getEntriesUseCase.execute).toHaveBeenCalledWith('comp-1');
    expect(exportPleUseCase.execute).toHaveBeenCalledWith({ ...dto, companyId: 'comp-1' }, []);
  });
});