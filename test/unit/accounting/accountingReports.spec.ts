import { BadRequestException } from '@nestjs/common';
import { GetLedgerUseCase } from '../../../src/modules/accounting/application/use-cases/getLedgerUseCase';
import { GetTrialBalanceUseCase } from '../../../src/modules/accounting/application/use-cases/getTrialBalanceUseCase';
import { GetIncomeStatementUseCase } from '../../../src/modules/accounting/application/use-cases/getIncomeStatementUseCase';
import type { IAccountingRepositoryPort } from '../../../src/modules/accounting/domain/ports/accountingRepositoryPort';

describe('Reportes contables', () => {
  let repository: jest.Mocked<IAccountingRepositoryPort>;

  beforeEach(() => {
    repository = {
      findAccounts: jest.fn().mockResolvedValue([
        { code: '1211', name: 'Cuentas por cobrar', element: 'Activo', nature: 'Deudora', parentCode: '12', level: 4, isActive: true },
      ]),
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
});
