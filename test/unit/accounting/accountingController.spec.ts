import { ForbiddenException } from '@nestjs/common';
import { AccountingController } from '../../../src/modules/accounting/infrastructure/controllers/accountingController';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import { GenerateClosingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateClosingEntryUseCase';
import { ExportPleTxtUseCase } from '../../../src/modules/accounting/application/use-cases/exportPleTxtUseCase';
import { GetAccountingEntriesUseCase } from '../../../src/modules/accounting/application/use-cases/getAccountingEntriesUseCase';
import { ListAccountingAccountsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingAccountsUseCase';
import { CreateAccountingAccountUseCase } from '../../../src/modules/accounting/application/use-cases/createAccountingAccountUseCase';
import { ListAccountingPeriodsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingPeriodsUseCase';
import { OpenAccountingPeriodUseCase } from '../../../src/modules/accounting/application/use-cases/openAccountingPeriodUseCase';
import { OpenFiscalYearUseCase } from '../../../src/modules/accounting/application/use-cases/openFiscalYearUseCase';
import { CloseFiscalYearUseCase } from '../../../src/modules/accounting/application/use-cases/closeFiscalYearUseCase';
import { CloseAccountingPeriodUseCase } from '../../../src/modules/accounting/application/use-cases/closeAccountingPeriodUseCase';
import { GetLedgerUseCase } from '../../../src/modules/accounting/application/use-cases/getLedgerUseCase';
import { GetTrialBalanceUseCase } from '../../../src/modules/accounting/application/use-cases/getTrialBalanceUseCase';
import { GetIncomeStatementUseCase } from '../../../src/modules/accounting/application/use-cases/getIncomeStatementUseCase';
import { GetBalanceSheetUseCase } from '../../../src/modules/accounting/application/use-cases/getBalanceSheetUseCase';
import { AccountingEntryEntity } from '../../../src/modules/accounting/domain/entities/accountingEntryEntity';

describe('AccountingController', () => {
  let controller: AccountingController;
  let generateUseCase: jest.Mocked<GenerateAccountingEntryUseCase>;
  let closingUseCase: jest.Mocked<GenerateClosingEntryUseCase>;
  let exportPleUseCase: jest.Mocked<ExportPleTxtUseCase>;
  let getEntriesUseCase: jest.Mocked<GetAccountingEntriesUseCase>;
  let listAccountsUseCase: jest.Mocked<ListAccountingAccountsUseCase>;
  let createAccountUseCase: jest.Mocked<CreateAccountingAccountUseCase>;
  let listPeriodsUseCase: jest.Mocked<ListAccountingPeriodsUseCase>;
  let openPeriodUseCase: jest.Mocked<OpenAccountingPeriodUseCase>;
  let closePeriodUseCase: jest.Mocked<CloseAccountingPeriodUseCase>;
  let openFiscalYearUseCase: jest.Mocked<OpenFiscalYearUseCase>;
  let closeFiscalYearUseCase: jest.Mocked<CloseFiscalYearUseCase>;
  let getLedgerUseCase: jest.Mocked<GetLedgerUseCase>;
  let getTrialBalanceUseCase: jest.Mocked<GetTrialBalanceUseCase>;
  let getIncomeStatementUseCase: jest.Mocked<GetIncomeStatementUseCase>;
  let getBalanceSheetUseCase: jest.Mocked<GetBalanceSheetUseCase>;
  let mockPrisma: any;

  beforeEach(() => {
    generateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GenerateAccountingEntryUseCase>;
    closingUseCase = {
      execute: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<GenerateClosingEntryUseCase>;

    exportPleUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ExportPleTxtUseCase>;

    getEntriesUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<GetAccountingEntriesUseCase>;

    listAccountsUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ListAccountingAccountsUseCase>;
    createAccountUseCase = {
      execute: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<CreateAccountingAccountUseCase>;

    listPeriodsUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ListAccountingPeriodsUseCase>;

    openPeriodUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<OpenAccountingPeriodUseCase>;

    closePeriodUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CloseAccountingPeriodUseCase>;
    openFiscalYearUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<OpenFiscalYearUseCase>;
    closeFiscalYearUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<CloseFiscalYearUseCase>;

    getLedgerUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetLedgerUseCase>;
    getTrialBalanceUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetTrialBalanceUseCase>;
    getIncomeStatementUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetIncomeStatementUseCase>;
    getBalanceSheetUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetBalanceSheetUseCase>;

    mockPrisma = {
      accountingMapping: {
        findMany: jest.fn().mockResolvedValue([
          { process_code: 'COMPRA', role_code: 'GASTO_COMPRA', account_code: '60111-CUSTOM' },
        ]),
        upsert: jest.fn().mockResolvedValue({ id: 'map-1' }),
      },
    };

    controller = new AccountingController(
      generateUseCase,
      closingUseCase,
      exportPleUseCase,
      getEntriesUseCase,
      listAccountsUseCase,
      createAccountUseCase,
      listPeriodsUseCase,
      openPeriodUseCase,
      openFiscalYearUseCase,
      closeFiscalYearUseCase,
      closePeriodUseCase,
      getLedgerUseCase,
      getTrialBalanceUseCase,
      getIncomeStatementUseCase,
      getBalanceSheetUseCase,
      mockPrisma,
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
      // Empresa del cuerpo: debe ignorarse en favor de la del token.
      companyId: 'empresa-del-cuerpo',
      period: '2026-03',
      entryDate: '2026-03-01T00:00:00.000Z',
      glosa: 'Venta',
      sourceModule: 'INVOICES',
      lines: [],
    };

    const result = await controller.createEntry(dto, 'comp-1');

    expect(result).toBe(mockEntry);
    expect(generateUseCase.execute).toHaveBeenCalledWith({
      ...dto,
      companyId: 'comp-1',
    });
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

    const result = await controller.exportPle(dto, 'comp-1');

    expect(result).toBe(mockExportResult);
    // El periodo sale del cuerpo de la peticion: antes se llamaba sin el y el
    // caso de uso caia en su valor por defecto (2026-10), asi que el libro se
    // generaba con los asientos de otro mes.
    expect(getEntriesUseCase.execute).toHaveBeenCalledWith('comp-1', '2026-03');
    expect(exportPleUseCase.execute).toHaveBeenCalledWith({ ...dto, companyId: 'comp-1' }, []);
  });

  it('rechaza las peticiones cuando el token no trae empresa', async () => {
    const dto = {
      companyId: 'comp-1',
      period: '2026-03',
      entryDate: '2026-03-01T00:00:00.000Z',
      glosa: 'Venta',
      sourceModule: 'INVOICES',
      lines: [],
    };
    const pleDto = {
      companyId: 'comp-1',
      companyRuc: '20100070970',
      year: 2026,
      month: 3,
      bookCode: '050100',
    };

    await expect(controller.getEntries()).rejects.toThrow(ForbiddenException);
    await expect(controller.createEntry(dto)).rejects.toThrow(ForbiddenException);
    await expect(controller.exportPle(pleDto)).rejects.toThrow(ForbiddenException);
    await expect(controller.getPeriods()).rejects.toThrow(ForbiddenException);
    await expect(controller.openPeriod({ year: 2026, month: 11 })).rejects.toThrow(ForbiddenException);
    await expect(controller.closePeriod('2026-11')).rejects.toThrow(ForbiddenException);
  });

  it('lista el catálogo PCGE', async () => {
    const accounts = [{ code: '1211', name: 'Cuentas por cobrar', element: 'Activo', nature: 'Deudora' as const, parentCode: '12', level: 4, isActive: true }];
    listAccountsUseCase.execute.mockResolvedValue(accounts);

    await expect(controller.getAccounts()).resolves.toBe(accounts);
    expect(listAccountsUseCase.execute).toHaveBeenCalled();
  });

  it('lista los períodos de la empresa del token', async () => {
    const periods = [{ companyId: 'comp-1', period: '2026-11', year: 2026, month: 11, status: 'ABIERTO' as const, openedAt: new Date() }];
    listPeriodsUseCase.execute.mockResolvedValue(periods);

    await expect(controller.getPeriods('comp-1')).resolves.toBe(periods);
    expect(listPeriodsUseCase.execute).toHaveBeenCalledWith('comp-1');
  });

  it('abre y cierra un período usando la empresa del token', async () => {
    const period = { companyId: 'comp-1', period: '2026-11', year: 2026, month: 11, status: 'ABIERTO' as const, openedAt: new Date() };
    openPeriodUseCase.execute.mockResolvedValue(period);
    closePeriodUseCase.execute.mockResolvedValue({ ...period, status: 'CERRADO' });

    await expect(controller.openPeriod({ year: 2026, month: 11 }, 'comp-1')).resolves.toBe(period);
    expect(openPeriodUseCase.execute).toHaveBeenCalledWith('comp-1', 2026, 11);

    await expect(controller.closePeriod('2026-11', 'comp-1')).resolves.toMatchObject({ status: 'CERRADO' });
    expect(closePeriodUseCase.execute).toHaveBeenCalledWith('comp-1', '2026-11');
  });

  it('delega el libro mayor y el balance de comprobación', async () => {
    const ledger = { period: '2026-11', accountCode: '1211', accountName: 'CxC', nature: 'Deudora' as const, openingBalance: 0, movements: [], totalDebit: 0, totalCredit: 0, closingBalance: 0 };
    const balance = { period: '2026-11', rows: [], totalDebit: 0, totalCredit: 0 };
    getLedgerUseCase.execute.mockResolvedValue(ledger);
    getTrialBalanceUseCase.execute.mockResolvedValue(balance);

    await expect(controller.getLedger('comp-1', '2026-11', '1211')).resolves.toBe(ledger);
    expect(getLedgerUseCase.execute).toHaveBeenCalledWith('comp-1', '2026-11', '1211');

    await expect(controller.getTrialBalance('comp-1', '2026-11')).resolves.toBe(balance);
    expect(getTrialBalanceUseCase.execute).toHaveBeenCalledWith('comp-1', '2026-11');
  });

  it('obtiene y actualiza los mapeos contables por proceso y rol', async () => {
    const mappings = await controller.getAccountingMappings('comp-1');
    expect(mappings.length).toBeGreaterThan(0);
    const customMapping = mappings.find((m) => m.process_code === 'COMPRA' && m.role_code === 'GASTO_COMPRA');
    expect(customMapping?.account_code).toBe('60111-CUSTOM');
    expect(customMapping?.is_custom).toBe(true);

    const updated = await controller.updateAccountingMapping(
      { process_code: 'VENTA', role_code: 'INGRESO', account_code: '70111' },
      'comp-1',
    );
    expect(updated).toEqual({ id: 'map-1' });
  });

  it('delega el estado de resultados', async () => {
    const statement = {
      period: '2026-11',
      groups: [],
      ingresos: 0,
      costoVentas: 0,
      gastosOperativos: 0,
      resultadoBruto: 0,
      resultadoOperativo: 0,
    };
    getIncomeStatementUseCase.execute.mockResolvedValue(statement);

    await expect(controller.getIncomeStatement('comp-1', '2026-11')).resolves.toBe(statement);
    expect(getIncomeStatementUseCase.execute).toHaveBeenCalledWith('comp-1', '2026-11');
  });

  it('abre el año fiscal de la empresa del token', async () => {
    openFiscalYearUseCase.execute.mockResolvedValue([]);
    await expect(controller.openFiscalYear('2026', 'comp-1')).resolves.toEqual([]);
    expect(openFiscalYearUseCase.execute).toHaveBeenCalledWith('comp-1', 2026);
  });

  it('cierra el año fiscal de la empresa del token', async () => {
    closeFiscalYearUseCase.execute.mockResolvedValue([]);
    await expect(controller.closeFiscalYear('2026', 'comp-1')).resolves.toEqual([]);
    expect(closeFiscalYearUseCase.execute).toHaveBeenCalledWith('comp-1', 2026);
  });
});