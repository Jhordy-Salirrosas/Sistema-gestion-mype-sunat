import { CloseAnnualUseCase } from '../../../src/modules/accounting/application/use-cases/closeAnnualUseCase';

describe('CloseAnnualUseCase', () => {
  it('genera cierre y bloquea el año', async () => {
    const repository = { closeFiscalYear: jest.fn().mockResolvedValue([{ period: '2026-12', status: 'CERRADO' }]) };
    const closing = { execute: jest.fn().mockResolvedValue({ asiento: { id: 'a1' } }) };
    const r = await new CloseAnnualUseCase(repository as never, closing as never).execute('c1', 2026);
    expect(r.closingEntryCreated).toBe(true);
    expect(repository.closeFiscalYear).toHaveBeenCalledWith('c1', 2026);
  });

  it('no duplica el asiento de cierre si ya existe', async () => {
    const repository = { closeFiscalYear: jest.fn().mockResolvedValue([]) };
    const closing = { execute: jest.fn().mockRejectedValue(new Error('El asiento de cierre 2026 ya existe.')) };
    const r = await new CloseAnnualUseCase(repository as never, closing as never).execute('c1', 2026);
    expect(r.closingEntryCreated).toBe(false);
    expect(repository.closeFiscalYear).toHaveBeenCalled();
  });
});
