import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { AccountingPlanCuentasController } from '../../../src/modules/accounting/infrastructure/controllers/accountingPlanCuentasController';
import type { ListAccountingAccountsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingAccountsUseCase';

describe('AccountingPlanCuentasController', () => {
  const accounts = {
    execute: jest.fn().mockResolvedValue([
      {
        code: '701',
        name: 'Ventas de mercaderías',
        element: '7',
        nature: 'Acreedora',
        parentCode: null,
        level: 3,
        isActive: true,
      },
    ]),
  } as unknown as ListAccountingAccountsUseCase & { execute: jest.Mock };

  const controller = new AccountingPlanCuentasController(accounts);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes the Spanish and historical accounting prefixes', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, AccountingPlanCuentasController),
    ).toEqual(['api/v1/contabilidad', 'api/v1/accounting']);
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        AccountingPlanCuentasController.prototype.listar,
      ),
    ).toBe('plan-cuentas');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AccountingPlanCuentasController),
    ).toContain(AuthGuard);
  });

  it('lists only active PCGE accounts by default', async () => {
    await expect(controller.listar()).resolves.toHaveLength(1);
    expect(accounts.execute).toHaveBeenCalledWith(false);
  });

  it('allows including inactive accounts when asked', async () => {
    await controller.listar('true');

    expect(accounts.execute).toHaveBeenCalledWith(true);
  });
});
