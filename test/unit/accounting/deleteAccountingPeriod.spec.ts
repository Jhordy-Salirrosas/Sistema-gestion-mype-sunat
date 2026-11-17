import { DeleteAccountingPeriodUseCase } from '../../../src/modules/accounting/application/use-cases/deleteAccountingPeriodUseCase';

/**
 * Borrar un período solo es seguro si no tiene asientos: de lo contrario las
 * líneas contables quedarían apuntando a un mes inexistente.
 */
describe('DeleteAccountingPeriodUseCase', () => {
  const crearRepositorio = (opciones: { existe?: boolean; asientos?: number } = {}) => ({
    findPeriod: jest.fn().mockResolvedValue(opciones.existe === false ? null : { period: '2027-01', status: 'ABIERTO' }),
    countEntriesByPeriod: jest.fn().mockResolvedValue(opciones.asientos ?? 0),
    deletePeriod: jest.fn().mockResolvedValue(undefined),
  });

  it('elimina un período vacío', async () => {
    const repo = crearRepositorio();
    const caso = new DeleteAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2027-01')).resolves.toEqual({ period: '2027-01', deleted: true });
    expect(repo.deletePeriod).toHaveBeenCalledWith('c1', '2027-01');
  });

  it('rechaza un período con asientos y no lo borra', async () => {
    const repo = crearRepositorio({ asientos: 3 });
    const caso = new DeleteAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2027-01')).rejects.toThrow('3 asiento(s)');
    expect(repo.deletePeriod).not.toHaveBeenCalled();
  });

  it('rechaza un período inexistente', async () => {
    const repo = crearRepositorio({ existe: false });
    const caso = new DeleteAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2027-01')).rejects.toThrow('no existe');
    expect(repo.deletePeriod).not.toHaveBeenCalled();
  });

  it('rechaza un período con formato inválido', async () => {
    const repo = crearRepositorio();
    const caso = new DeleteAccountingPeriodUseCase(repo as never);

    await expect(caso.execute('c1', '2027-13')).rejects.toThrow('YYYY-MM');
    expect(repo.findPeriod).not.toHaveBeenCalled();
  });
});
