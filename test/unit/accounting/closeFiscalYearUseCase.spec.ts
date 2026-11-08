import { CloseFiscalYearUseCase } from '../../../src/modules/accounting/application/use-cases/closeFiscalYearUseCase';

describe('CloseFiscalYearUseCase', () => {
  it('delega el cierre del año al repositorio', async () => {
    const repository = { closeFiscalYear: jest.fn().mockResolvedValue([]) };
    const useCase = new CloseFiscalYearUseCase(repository as never);
    await expect(useCase.execute('c1', 2026)).resolves.toEqual([]);
    expect(repository.closeFiscalYear).toHaveBeenCalledWith('c1', 2026);
  });
});
