import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ICompanyConfigurationRepositoryPort } from '../../../src/modules/sire/domain/ports/companyConfigurationRepositoryPort';
import { GetCompanyConfigurationUseCase } from '../../../src/modules/sire/application/use-cases/getCompanyConfigurationUseCase';
import { UpdateCompanyConfigurationUseCase } from '../../../src/modules/sire/application/use-cases/updateCompanyConfigurationUseCase';

const COMPANY_ID = 'company-id';

function crearRepositorio() {
  return {
    findByCompanyId: jest.fn(),
    update: jest.fn(),
  } as unknown as ICompanyConfigurationRepositoryPort & {
    findByCompanyId: jest.Mock;
    update: jest.Mock;
  };
}

describe('GetCompanyConfigurationUseCase', () => {
  it('returns the stored configuration', async () => {
    const repository = crearRepositorio();
    repository.findByCompanyId.mockResolvedValue({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      series: ['F001', 'B001'],
    });
    const useCase = new GetCompanyConfigurationUseCase(repository);

    await expect(useCase.execute(COMPANY_ID)).resolves.toEqual({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      series: ['F001', 'B001'],
    });
    expect(repository.findByCompanyId).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('throws NotFound when the company does not exist', async () => {
    const repository = crearRepositorio();
    repository.findByCompanyId.mockResolvedValue(null);
    const useCase = new GetCompanyConfigurationUseCase(repository);

    await expect(useCase.execute(COMPANY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('UpdateCompanyConfigurationUseCase', () => {
  function crearCaso() {
    const repository = crearRepositorio();
    return {
      repository,
      useCase: new UpdateCompanyConfigurationUseCase(repository),
    };
  }

  it('trims the name and normalizes the series', async () => {
    const { repository, useCase } = crearCaso();
    repository.update.mockResolvedValue({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      series: ['F001', 'B001'],
    });

    await useCase.execute(COMPANY_ID, {
      businessName: '  Demo SAC  ',
      series: [' f001 ', 'b001', 'F001', '  '],
    });

    expect(repository.update).toHaveBeenCalledWith(COMPANY_ID, {
      businessName: 'Demo SAC',
      series: ['F001', 'B001'],
    });
  });

  it('updates only the fields that were sent', async () => {
    const { repository, useCase } = crearCaso();
    repository.update.mockResolvedValue({
      ruc: '20123456789',
      businessName: null,
      series: ['F001'],
    });

    await useCase.execute(COMPANY_ID, { series: ['F001'] });

    expect(repository.update).toHaveBeenCalledWith(COMPANY_ID, {
      series: ['F001'],
    });
  });

  it('rejects an empty payload', async () => {
    const { repository, useCase } = crearCaso();

    await expect(useCase.execute(COMPANY_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects a blank business name', async () => {
    const { repository, useCase } = crearCaso();

    await expect(
      useCase.execute(COMPANY_ID, { businessName: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('throws NotFound when the company does not exist', async () => {
    const { repository, useCase } = crearCaso();
    repository.update.mockResolvedValue(null);

    await expect(
      useCase.execute(COMPANY_ID, { businessName: 'Demo SAC' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
