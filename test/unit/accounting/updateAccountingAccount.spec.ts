import { UpdateAccountingAccountUseCase } from '../../../src/modules/accounting/application/use-cases/updateAccountingAccountUseCase';

/**
 * Edición del catálogo: renombrar, cambiar tipo, activar y desactivar.
 *
 * La inactivación es en cascada y tiene dos bloqueos: saldo en el período y
 * padre inactivo al intentar reactivar una subcuenta.
 */
describe('UpdateAccountingAccountUseCase', () => {
  const cuentasBase = [
    { code: '1', name: 'Activo', element: 'Activo', nature: 'Deudora', parentCode: null, level: 1, isActive: true },
    { code: '12', name: 'Cuentas por cobrar', element: 'Activo', nature: 'Deudora', parentCode: '1', level: 2, isActive: true },
    { code: '1212', name: 'En cartera', element: 'Activo', nature: 'Deudora', parentCode: '12', level: 4, isActive: true },
  ];

  const crearRepositorio = (opciones: {
    cuentas?: typeof cuentasBase;
    saldo?: number;
    reglas?: number;
    tesoreria?: boolean;
    descendientes?: string[];
  } = {}) => ({
    findAccounts: jest.fn().mockResolvedValue(opciones.cuentas ?? cuentasBase),
    findPeriods: jest.fn().mockResolvedValue([{ period: '2026-11', status: 'ABIERTO' }]),
    accountPeriodBalance: jest.fn().mockResolvedValue(opciones.saldo ?? 0),
    accountUsedInRules: jest.fn().mockResolvedValue(opciones.reglas ?? 0),
    accountIsTreasury: jest.fn().mockResolvedValue(opciones.tesoreria ?? false),
    findDescendantCodes: jest.fn().mockResolvedValue(opciones.descendientes ?? []),
    setAccountsActive: jest.fn().mockResolvedValue(1),
    registrarInactivacion: jest.fn().mockResolvedValue(undefined),
    updateAccount: jest.fn().mockImplementation(async (code: string, cambios: object) => ({
      ...cuentasBase.find((c) => c.code === code),
      code,
      ...cambios,
    })),
  });

  it('cambia el nombre de la cuenta', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    const resultado = await caso.execute('c1', '1212', { name: 'Emitidas en cartera' });

    expect(repo.updateAccount).toHaveBeenCalledWith('1212', { name: 'Emitidas en cartera' });
    expect(resultado.account.name).toBe('Emitidas en cartera');
  });

  it('cambia el tipo de cuenta (elemento del PCGE)', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    await caso.execute('c1', '1212', { element: 'Activo realizable' });

    expect(repo.updateAccount).toHaveBeenCalledWith('1212', { element: 'Activo realizable' });
  });

  it('desactiva la cuenta y sus descendientes', async () => {
    const repo = crearRepositorio({ descendientes: ['12121', '12122'] });
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    const resultado = await caso.execute('c1', '12', { isActive: false });

    expect(repo.setAccountsActive).toHaveBeenCalledWith(['12121', '12122'], false);
    expect(repo.setAccountsActive).toHaveBeenCalledWith(['12'], false);
    expect(resultado.descendientesAfectados).toBe(1);
    expect(resultado.account.isActive).toBe(false);
  });

  it('rechaza desactivar una cuenta con saldo en el período', async () => {
    const repo = crearRepositorio({ saldo: 1250.5 });
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    await expect(caso.execute('c1', '1212', { isActive: false })).rejects.toThrow('saldo de S/ 1,250.50');
    expect(repo.setAccountsActive).not.toHaveBeenCalled();
  });

  it('avisa cuando la cuenta se usa en reglas o tesorería', async () => {
    const repo = crearRepositorio({ reglas: 2, tesoreria: true });
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    const resultado = await caso.execute('c1', '1212', { isActive: false });

    expect(resultado.advertencias.join(' ')).toContain('2 regla');
    expect(resultado.advertencias.join(' ')).toContain('tesorería');
  });

  it('no permite reactivar una subcuenta con el padre inactivo', async () => {
    const cuentas = cuentasBase.map((c) => (c.code === '12' ? { ...c, isActive: false } : c));
    const repo = crearRepositorio({ cuentas });
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    await expect(caso.execute('c1', '1212', { isActive: true })).rejects.toThrow('Active primero la cuenta padre');
    expect(repo.setAccountsActive).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta que no existe', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    await expect(caso.execute('c1', '9999', { isActive: false })).rejects.toThrow('no existe');
  });

  it('rechaza una edición vacía', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    await expect(caso.execute('c1', '1212', {})).rejects.toThrow('Indica el nombre');
  });
});
