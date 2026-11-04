import { ListAccountingAccountsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingAccountsUseCase';
import { ListAccountingPeriodsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingPeriodsUseCase';
import { OpenAccountingPeriodUseCase } from '../../../src/modules/accounting/application/use-cases/openAccountingPeriodUseCase';
import { CloseAccountingPeriodUseCase } from '../../../src/modules/accounting/application/use-cases/closeAccountingPeriodUseCase';
import type { IAccountingRepositoryPort } from '../../../src/modules/accounting/domain/ports/accountingRepositoryPort';

describe('Casos de uso del catálogo contable', () => {
  const repository = {
    findAccounts: jest.fn(),
    findPeriods: jest.fn(),
    openPeriod: jest.fn(),
    closePeriod: jest.fn(),
  } as unknown as jest.Mocked<IAccountingRepositoryPort>;

  beforeEach(() => jest.clearAllMocks());

  it('lista las cuentas', async () => {
    const accounts = [{ code: '1211', name: 'CxC', element: 'Activo', nature: 'Deudora' as const, parentCode: '12', level: 4, isActive: true }];
    repository.findAccounts.mockResolvedValue(accounts);
    await expect(new ListAccountingAccountsUseCase(repository).execute()).resolves.toBe(accounts);
  });

  it('lista los períodos', async () => {
    const periods = [{ companyId: 'c1', period: '2026-11', year: 2026, month: 11, status: 'ABIERTO' as const, openedAt: new Date() }];
    repository.findPeriods.mockResolvedValue(periods);
    await expect(new ListAccountingPeriodsUseCase(repository).execute('c1')).resolves.toBe(periods);
    expect(repository.findPeriods).toHaveBeenCalledWith('c1');
  });

  it('abre un período', async () => {
    const period = { companyId: 'c1', period: '2026-11', year: 2026, month: 11, status: 'ABIERTO' as const, openedAt: new Date() };
    repository.openPeriod.mockResolvedValue(period);
    await expect(new OpenAccountingPeriodUseCase(repository).execute('c1', 2026, 11)).resolves.toBe(period);
    expect(repository.openPeriod).toHaveBeenCalledWith('c1', 2026, 11);
  });

  it('cierra un período', async () => {
    const period = { companyId: 'c1', period: '2026-11', year: 2026, month: 11, status: 'CERRADO' as const, openedAt: new Date(), closedAt: new Date() };
    repository.closePeriod.mockResolvedValue(period);
    await expect(new CloseAccountingPeriodUseCase(repository).execute('c1', '2026-11')).resolves.toBe(period);
    expect(repository.closePeriod).toHaveBeenCalledWith('c1', '2026-11');
  });
});
