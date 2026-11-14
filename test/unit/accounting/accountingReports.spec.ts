import { BadRequestException } from '@nestjs/common';
import { GetLedgerUseCase } from '../../../src/modules/accounting/application/use-cases/getLedgerUseCase';
import { GetTrialBalanceUseCase } from '../../../src/modules/accounting/application/use-cases/getTrialBalanceUseCase';
import { GetIncomeStatementUseCase } from '../../../src/modules/accounting/application/use-cases/getIncomeStatementUseCase';
import { GetBalanceSheetUseCase } from '../../../src/modules/accounting/application/use-cases/getBalanceSheetUseCase';
import type { IAccountingRepositoryPort } from '../../../src/modules/accounting/domain/ports/accountingRepositoryPort';

describe('Reportes contables', () => {
  let repository: jest.Mocked<IAccountingRepositoryPort>;

  beforeEach(() => {
    repository = {
      findAccounts: jest.fn().mockResolvedValue([
        { code: '1211', name: 'Cuentas por cobrar', element: 'Activo', nature: 'Deudora', parentCode: '12', level: 4, isActive: true },
      ]),
      findLedgerOpeningBalance: jest.fn().mockResolvedValue(0),
      findLedgerMovements: jest.fn().mockResolvedValue([
        { entryId: 'e1', entryNumber: 1, entryDate: new Date('2026-11-01'), glosa: 'Venta', sourceModule: 'M1_INVOICES', accountCode: '1211', accountName: 'Cuentas por cobrar', debit: 118, credit: 0 },
        { entryId: 'e2', entryNumber: 2, entryDate: new Date('2026-11-02'), glosa: 'Cobro', sourceModule: 'MANUAL', accountCode: '1211', accountName: 'Cuentas por cobrar', debit: 0, credit: 50 },
      ]),
      findTrialBalanceRows: jest.fn().mockResolvedValue([
        { accountCode: '1211', accountName: 'Cuentas por cobrar', debit: 118, credit: 50 },
        { accountCode: '7011', accountName: 'Ventas', debit: 0, credit: 68 },
      ]),
    } as unknown as jest.Mocked<IAccountingRepositoryPort>;
  });

  it('calcula el saldo acumulado del libro mayor', async () => {
    const result = await new GetLedgerUseCase(repository).execute('c1', '2026-11', '1211');
    expect(result.movements.map((m) => m.saldo)).toEqual([118, 68]);
    expect(result.totalDebit).toBe(118);
    expect(result.totalCredit).toBe(50);
    expect(result.closingBalance).toBe(68);
  });

  it('arrastra el saldo inicial de períodos anteriores', async () => {
    repository.findLedgerOpeningBalance.mockResolvedValue(200);
    const result = await new GetLedgerUseCase(repository).execute('c1', '2026-11', '1211');
    expect(result.openingBalance).toBe(200);
    expect(result.movements.map((m) => m.saldo)).toEqual([318, 268]);
  });

  it('el saldo final incluye el saldo de apertura', async () => {
    repository.findLedgerOpeningBalance.mockResolvedValue(200);
    const result = await new GetLedgerUseCase(repository).execute('c1', '2026-11', '1211');
    expect(result.closingBalance).toBe(268);
  });

  it('el mayor de una cuenta de mayor incluye sus subcuentas', async () => {
    repository.findAccounts.mockResolvedValue([
      { code: '104', name: 'Cuentas corrientes', element: 'Activo', nature: 'Deudora', parentCode: '10', level: 3, isActive: true },
      { code: '1041', name: 'Cuenta corriente operativa', element: 'Activo', nature: 'Deudora', parentCode: '104', level: 4, isActive: true },
      { code: '1042', name: 'Cuenta corriente BCP', element: 'Activo', nature: 'Deudora', parentCode: '104', level: 4, isActive: true },
    ]);
    repository.findLedgerMovementsByAccounts = jest.fn().mockResolvedValue([
      { entryId: 'e1', entryNumber: 1, entryDate: new Date('2026-11-01'), glosa: 'Cobro', sourceModule: 'COLLECTIONS', accountCode: '1041', accountName: 'Cuenta corriente operativa', debit: 100, credit: 0 },
      { entryId: 'e2', entryNumber: 2, entryDate: new Date('2026-11-02'), glosa: 'Cobro', sourceModule: 'COLLECTIONS', accountCode: '1042', accountName: 'Cuenta corriente BCP', debit: 50, credit: 0 },
    ]);
    repository.findLedgerOpeningBalanceByAccounts = jest.fn().mockResolvedValue(10);

    const result = await new GetLedgerUseCase(repository).execute('c1', '2026-11', '104');

    expect(result.subcuentas).toEqual(['104', '1041', '1042']);
    expect(result.movements.map((m) => m.accountCode)).toEqual(['1041', '1042']);
    expect(result.openingBalance).toBe(10);
    expect(result.closingBalance).toBe(160);
    expect(repository.findLedgerMovements).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta inexistente', async () => {
    await expect(new GetLedgerUseCase(repository).execute('c1', '2026-11', '9999')).rejects.toThrow(BadRequestException);
  });

  it('calcula el balance de comprobación', async () => {
    const result = await new GetTrialBalanceUseCase(repository).execute('c1', '2026-11');
    expect(result.totalDebit).toBe(118);
    expect(result.totalCredit).toBe(118);
    expect(result.rows).toHaveLength(2);
  });

  it('rechaza un período inválido', async () => {
    await expect(new GetTrialBalanceUseCase(repository).execute('c1', '202611')).rejects.toThrow(BadRequestException);
  });

  it('muestra el saldo positivo en una cuenta acreedora', async () => {
    repository.findAccounts.mockResolvedValue([
      { code: '70121', name: 'Ventas', element: 'Ingresos', nature: 'Acreedora', parentCode: '701', level: 5, isActive: true },
    ]);
    repository.findLedgerMovements.mockResolvedValue([
      { entryId: 'e1', entryNumber: 1, entryDate: new Date('2026-11-01'), glosa: 'Venta', sourceModule: 'M1_INVOICES', accountCode: '70121', accountName: 'Ventas', debit: 0, credit: 887 },
    ]);

    const result = await new GetLedgerUseCase(repository).execute('c1', '2026-11', '70121');
    expect(result.movements[0].saldo).toBe(887);
    expect(result.closingBalance).toBe(887);
  });

  it('clasifica ingresos, costo y gastos en el estado de resultados', async () => {
    repository.findTrialBalanceRows.mockResolvedValue([
      { accountCode: '70121', accountName: 'Ventas', debit: 0, credit: 12480 },
      { accountCode: '691', accountName: 'Costo de ventas', debit: 8000, credit: 0 },
      { accountCode: '941', accountName: 'Gastos administrativos', debit: 1000, credit: 0 },
    ]);

    const result = await new GetIncomeStatementUseCase(repository).execute('c1', '2026-11');
    expect(result.ingresos).toBe(12480);
    expect(result.costoVentas).toBe(8000);
    expect(result.gastosOperativos).toBe(1000);
    expect(result.resultadoBruto).toBe(4480);
    expect(result.resultadoOperativo).toBe(3480);
  });

  it('rechaza un periodo invalido en el estado de resultados', async () => {
    await expect(
      new GetIncomeStatementUseCase(repository).execute('c1', '2026-13'),
    ).rejects.toThrow(BadRequestException);
  });

  it('cuadra activo contra pasivo, patrimonio y resultado', async () => {
    repository.findTrialBalanceRows.mockResolvedValue([
      { accountCode: '12121', accountName: 'CxC', debit: 14726.4, credit: 0 },
      { accountCode: '40111', accountName: 'IGV', debit: 0, credit: 2246.4 },
      { accountCode: '70121', accountName: 'Ventas', debit: 0, credit: 12480 },
    ]);

    const result = await new GetBalanceSheetUseCase(repository).execute('c1', '2026-11');
    expect(result.totalActivo).toBe(14726.4);
    expect(result.pasivo.total).toBe(2246.4);
    expect(result.resultadoEjercicio).toBe(12480);
    expect(result.totalPasivoPatrimonio).toBe(14726.4);
    expect(result.cuadra).toBe(true);
  });
});
