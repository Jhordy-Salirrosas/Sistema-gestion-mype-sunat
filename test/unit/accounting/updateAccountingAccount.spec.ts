import { UpdateAccountingAccountUseCase } from '../../../src/modules/accounting/application/use-cases/updateAccountingAccountUseCase';

/**
 * Edición del catálogo: el plan permite renombrar y activar/desactivar una
 * cuenta. El código no se toca porque las líneas de asientos ya registrados
 * apuntan a él.
 */
describe('UpdateAccountingAccountUseCase', () => {
  const cuentas = [
    { code: '1212', name: 'En cartera', element: 'Activo', nature: 'Deudora', parentCode: '121', level: 4, isActive: true },
  ];

  const crearRepositorio = () => ({
    findAccounts: jest.fn().mockResolvedValue(cuentas),
    updateAccount: jest.fn().mockImplementation(async (code, cambios) => ({
      ...cuentas[0],
      code,
      ...cambios,
    })),
  });

  it('cambia el nombre de la cuenta', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    const resultado = await caso.execute('1212', { name: 'Emitidas en cartera' });

    expect(repo.updateAccount).toHaveBeenCalledWith('1212', { name: 'Emitidas en cartera' });
    expect(resultado.name).toBe('Emitidas en cartera');
  });

  it('desactiva la cuenta sin borrarla', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    const resultado = await caso.execute('1212', { isActive: false });

    expect(repo.updateAccount).toHaveBeenCalledWith('1212', { isActive: false });
    expect(resultado.isActive).toBe(false);
  });

  it('rechaza una cuenta que no existe', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    await expect(caso.execute('9999', { isActive: false })).rejects.toThrow('no existe');
    expect(repo.updateAccount).not.toHaveBeenCalled();
  });

  it('rechaza una edición vacía', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    await expect(caso.execute('1212', {})).rejects.toThrow('Indica el nombre');
  });

  it('cambia el tipo de cuenta (elemento del PCGE)', async () => {
    const repo = crearRepositorio();
    const caso = new UpdateAccountingAccountUseCase(repo as never);

    await caso.execute('1212', { element: 'Activo realizable' });

    expect(repo.updateAccount).toHaveBeenCalledWith('1212', { element: 'Activo realizable' });
  });
});
