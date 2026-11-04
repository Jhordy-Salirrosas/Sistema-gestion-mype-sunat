import { BadRequestException } from '@nestjs/common';
import {
  GetAccountingEntriesUseCase,
  periodoActual,
} from '../../../src/modules/accounting/application/use-cases/getAccountingEntriesUseCase';
import type { IAccountingRepositoryPort } from '../../../src/modules/accounting/domain/ports/accountingRepositoryPort';

describe('GetAccountingEntriesUseCase', () => {
  let repository: jest.Mocked<IAccountingRepositoryPort>;
  let useCase: GetAccountingEntriesUseCase;

  beforeEach(() => {
    repository = {
      findEntriesByPeriod: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IAccountingRepositoryPort>;
    useCase = new GetAccountingEntriesUseCase(repository);
  });

  it('consulta el período solicitado, no un mes fijo', async () => {
    await useCase.execute('company-1', '2026-03');

    expect(repository.findEntriesByPeriod).toHaveBeenCalledWith(
      'company-1',
      '2026-03',
    );
  });

  it('usa el mes corriente cuando no se envía período', async () => {
    await useCase.execute('company-1');

    expect(repository.findEntriesByPeriod).toHaveBeenCalledWith(
      'company-1',
      periodoActual(),
    );
  });

  it('rechaza un período con formato inválido', async () => {
    await expect(useCase.execute('company-1', '2026-13')).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.findEntriesByPeriod).not.toHaveBeenCalled();
  });
});
