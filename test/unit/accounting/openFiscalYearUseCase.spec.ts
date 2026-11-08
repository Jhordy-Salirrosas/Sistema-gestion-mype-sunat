import { OpenFiscalYearUseCase } from '../../../src/modules/accounting/application/use-cases/openFiscalYearUseCase';

describe('OpenFiscalYearUseCase', () => {
  it('delega la apertura del año al repositorio', async () => {
    const repository = { openFiscalYear: jest.fn().mockResolvedValue([]) };
    const useCase = new OpenFiscalYearUseCase(repository as never);
    await expect(useCase.execute('c1', 2026)).resolves.toEqual([]);
    expect(repository.openFiscalYear).toHaveBeenCalledWith('c1', 2026);
  });
});
