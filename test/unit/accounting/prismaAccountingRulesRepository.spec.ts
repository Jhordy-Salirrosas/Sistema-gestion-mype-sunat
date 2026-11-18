import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { PrismaService } from '../../../src/database/prismaService';

/**
 * Métodos del repositorio que sostienen las reglas de los módulos 1 y 4:
 * cascada de inactivación, saldo por período, usos en reglas y tesorería,
 * reapertura auditada y saldos del año para la vista previa del cierre.
 */
describe('PrismaAccountingRepository - reglas de cuentas y períodos', () => {
  let repository: PrismaAccountingRepository;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      accountingAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      accountingPeriod: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      accountingEntry: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      accountingRule: { count: jest.fn().mockResolvedValue(0) },
      companyTreasuryAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    repository = new PrismaAccountingRepository(prismaMock as unknown as PrismaService);
  });

  it('devuelve los descendientes por prefijo del código', async () => {
    prismaMock.accountingAccount.findMany.mockResolvedValue([{ code: '12121' }, { code: '12122' }]);

    const descendientes = await repository.findDescendantCodes('12');

    expect(descendientes).toEqual(['12121', '12122']);
    expect(prismaMock.accountingAccount.findMany).toHaveBeenCalledWith({
      where: { code: { startsWith: '12', not: '12' } },
      select: { code: true },
    });
  });

  it('no consulta la base si la lista de códigos está vacía', async () => {
    await expect(repository.setAccountsActive([], false)).resolves.toBe(0);
    expect(prismaMock.accountingAccount.updateMany).not.toHaveBeenCalled();
  });

  it('desactiva en cascada y sella la fecha de inactivación', async () => {
    await repository.setAccountsActive(['12', '121'], false);

    const llamada = prismaMock.accountingAccount.updateMany.mock.calls[0][0];
    expect(llamada.where).toEqual({ code: { in: ['12', '121'] } });
    expect(llamada.data.is_active).toBe(false);
    expect(llamada.data.inactive_at).toBeInstanceOf(Date);
  });

  it('al reactivar limpia la auditoría de la inactivación', async () => {
    await repository.setAccountsActive(['12'], true);

    const llamada = prismaMock.accountingAccount.updateMany.mock.calls[0][0];
    expect(llamada.data.inactive_at).toBeNull();
    expect(llamada.data.inactive_by).toBeNull();
  });

  it('registra quién inactivó la cuenta', async () => {
    await repository.registrarInactivacion('1212', 'u-1');

    expect(prismaMock.accountingAccount.updateMany).toHaveBeenCalledWith({
      where: { code: '1212' },
      data: { inactive_by: 'u-1' },
    });
  });

  it('no registra nada si falta el usuario', async () => {
    await repository.registrarInactivacion('1212');
    expect(prismaMock.accountingAccount.updateMany).not.toHaveBeenCalled();
  });

  it('suma debe menos haber de la cuenta y sus subcuentas', async () => {
    prismaMock.accountingEntry.findMany.mockResolvedValue([
      {
        lines: [
          { account_code: '1212', debit_amount: 100, credit_amount: 0 },
          { account_code: '12121', debit_amount: 50, credit_amount: 0 },
          { account_code: '1212', debit_amount: 0, credit_amount: 20 },
          { account_code: '70121', debit_amount: 0, credit_amount: 500 },
        ],
      },
    ]);

    await expect(repository.accountPeriodBalance('c1', '1212', '2026-11')).resolves.toBe(130);
  });

  it('cuenta las reglas activas que usan la cuenta', async () => {
    prismaMock.accountingRule.count.mockResolvedValue(3);

    await expect(repository.accountUsedInRules('c1', '1212')).resolves.toBe(3);
    expect(prismaMock.accountingRule.count).toHaveBeenCalledWith({
      where: { company_id: 'c1', account_code: '1212', is_active: true },
    });
  });

  it('detecta si la cuenta es de tesorería', async () => {
    prismaMock.companyTreasuryAccount.findFirst.mockResolvedValue({ id: 't1' });
    await expect(repository.accountIsTreasury('c1', '1041')).resolves.toBe(true);

    prismaMock.companyTreasuryAccount.findFirst.mockResolvedValue(null);
    await expect(repository.accountIsTreasury('c1', '1212')).resolves.toBe(false);
  });

  it('lista los códigos con movimientos, sin repetir y ordenados', async () => {
    prismaMock.accountingEntry.findMany.mockResolvedValue([
      { lines: [{ account_code: '12121' }, { account_code: '1011' }] },
      { lines: [{ account_code: '12121' }] },
    ]);

    await expect(repository.findAccountCodesWithMovements('c1', '2026-11')).resolves.toEqual(['1011', '12121']);
  });

  it('guarda el motivo y el usuario de la reapertura', async () => {
    await repository.registrarReapertura('c1', '2026-11', { motivo: 'Ajuste', usuarioId: 'u-1' });

    const llamada = prismaMock.accountingPeriod.updateMany.mock.calls[0][0];
    expect(llamada.where).toEqual({ company_id: 'c1', period: '2026-11' });
    expect(llamada.data.reopen_reason).toBe('Ajuste');
    expect(llamada.data.reopened_by).toBe('u-1');
    expect(llamada.data.reopened_at).toBeInstanceOf(Date);
  });

  it('anula el asiento de cierre del ejercicio', async () => {
    await repository.anularAsientoCierre('c1', 2026);

    expect(prismaMock.accountingEntry.updateMany).toHaveBeenCalledWith({
      where: {
        company_id: 'c1',
        source_module: 'CLOSING',
        source_reference_id: 'CIERRE-2026',
        status: { not: 'ANULADO' },
      },
      data: { status: 'ANULADO' },
    });
  });

  it('acumula los saldos del año por cuenta para la vista previa', async () => {
    prismaMock.accountingEntry.findMany.mockResolvedValue([
      {
        lines: [
          { account_code: '70121', account_name: 'Ventas', debit_amount: 0, credit_amount: 1180 },
          { account_code: '60111', account_name: 'Compras', debit_amount: 600, credit_amount: 0 },
        ],
      },
      {
        lines: [{ account_code: '70121', account_name: 'Ventas', debit_amount: 0, credit_amount: 20 }],
      },
    ]);

    const saldos = await repository.saldosDeResultado('c1', 2026);

    expect(saldos).toEqual([
      { code: '60111', name: 'Compras', debit: 600, credit: 0 },
      { code: '70121', name: 'Ventas', debit: 0, credit: 1200 },
    ]);
  });
});
