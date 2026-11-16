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
      direccion: 'AV. SIEMPRE VIVA 123',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      ubigeo: '150101',
      esAgenteRetencion: false,
      series: ['F001', 'B001'],
    });
    const useCase = new GetCompanyConfigurationUseCase(repository);

    await expect(useCase.execute(COMPANY_ID)).resolves.toEqual({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      direccion: 'AV. SIEMPRE VIVA 123',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      ubigeo: '150101',
      esAgenteRetencion: false,
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

  it('trims the text fields and normalizes estado, condicion and series', async () => {
    const { repository, useCase } = crearCaso();
    repository.update.mockResolvedValue({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      direccion: 'AV. SIEMPRE VIVA 123',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      ubigeo: '150101',
      esAgenteRetencion: true,
      series: ['F001', 'B001'],
    });

    await useCase.execute(COMPANY_ID, {
      businessName: '  Demo SAC  ',
      direccion: '  AV. SIEMPRE VIVA 123  ',
      estado: ' activo ',
      condicion: ' habido ',
      ubigeo: ' 150101 ',
      esAgenteRetencion: true,
      series: [' f001 ', 'b001', 'F001', '  '],
    });

    expect(repository.update).toHaveBeenCalledWith(COMPANY_ID, {
      businessName: 'Demo SAC',
      direccion: 'AV. SIEMPRE VIVA 123',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      ubigeo: '150101',
      esAgenteRetencion: true,
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

  it('rejects blank address, estado and condicion', async () => {
    const { repository, useCase } = crearCaso();

    await expect(
      useCase.execute(COMPANY_ID, { direccion: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.execute(COMPANY_ID, { estado: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.execute(COMPANY_ID, { condicion: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects an ubigeo that is not six digits', async () => {
    const { repository, useCase } = crearCaso();

    await expect(
      useCase.execute(COMPANY_ID, { ubigeo: '15010' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.execute(COMPANY_ID, { ubigeo: '15010A' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('updates only the retention agent flag when it is the only field sent', async () => {
    const { repository, useCase } = crearCaso();
    repository.update.mockResolvedValue({
      ruc: '20123456789',
      businessName: null,
      direccion: null,
      estado: null,
      condicion: null,
      ubigeo: null,
      esAgenteRetencion: true,
      series: [],
    });

    await useCase.execute(COMPANY_ID, { esAgenteRetencion: true });

    expect(repository.update).toHaveBeenCalledWith(COMPANY_ID, {
      esAgenteRetencion: true,
    });
  });

  it('throws NotFound when the company does not exist', async () => {
    const { repository, useCase } = crearCaso();
    repository.update.mockResolvedValue(null);

    await expect(
      useCase.execute(COMPANY_ID, { businessName: 'Demo SAC' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
