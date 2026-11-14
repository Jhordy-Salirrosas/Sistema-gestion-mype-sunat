import { BadRequestException } from '@nestjs/common';
import { ConsultarEstadoConfiguracionSireUseCase } from '../../../src/modules/sire/application/use-cases/consultarEstadoConfiguracionSireUseCase';
import { GuardarConfiguracionSireUseCase } from '../../../src/modules/sire/application/use-cases/guardarConfiguracionSireUseCase';
import type { ISireConfigurationRepositoryPort } from '../../../src/modules/sire/domain/ports/sireConfigurationRepositoryPort';

const COMPANY_ID = 'company-id';

function crearRepository(
  overrides: Partial<{
    save: jest.Mock;
    findByCompanyId: jest.Mock;
    isConfigured: jest.Mock;
  }> = {},
) {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByCompanyId: jest.fn().mockResolvedValue(null),
    isConfigured: jest.fn().mockResolvedValue(false),
    ...overrides,
  } as unknown as ISireConfigurationRepositoryPort & {
    save: jest.Mock;
    findByCompanyId: jest.Mock;
    isConfigured: jest.Mock;
  };
}

describe('GuardarConfiguracionSireUseCase', () => {
  it('stores the credentials of the company and reports the new state', async () => {
    const repository = crearRepository({
      isConfigured: jest.fn().mockResolvedValue(true),
    });
    const useCase = new GuardarConfiguracionSireUseCase(repository);

    const resultado = await useCase.execute(COMPANY_ID, {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      solUser: 'FAKEUSER',
      solPassword: 'fake-sol-password',
    });

    expect(resultado).toEqual({ configured: true });
    expect(repository.save).toHaveBeenCalledWith(COMPANY_ID, {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      solUser: 'FAKEUSER',
      solPassword: 'fake-sol-password',
    });
  });

  it('removes the surrounding blanks of the identifiers but not of the password', async () => {
    const repository = crearRepository();
    const useCase = new GuardarConfiguracionSireUseCase(repository);

    await useCase.execute(COMPANY_ID, {
      clientId: '  client-id  ',
      solUser: ' FAKEUSER ',
      solPassword: '  fake-sol-password  ',
    });

    expect(repository.save).toHaveBeenCalledWith(COMPANY_ID, {
      clientId: 'client-id',
      clientSecret: undefined,
      solUser: 'FAKEUSER',
      solPassword: '  fake-sol-password  ',
    });
  });

  it('leaves the fields that were not sent undefined so they are preserved', async () => {
    const repository = crearRepository();
    const useCase = new GuardarConfiguracionSireUseCase(repository);

    await useCase.execute(COMPANY_ID, { solUser: 'FAKEUSER' });

    expect(repository.save).toHaveBeenCalledWith(COMPANY_ID, {
      clientId: undefined,
      clientSecret: undefined,
      solUser: 'FAKEUSER',
      solPassword: undefined,
    });
  });

  it('rejects a request without any credential', async () => {
    const repository = crearRepository();
    const useCase = new GuardarConfiguracionSireUseCase(repository);

    await expect(useCase.execute(COMPANY_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(useCase.execute(COMPANY_ID, {})).rejects.toThrow(
      'No se recibió ninguna credencial SIRE para guardar.',
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('reports that the company is not configured when a credential is missing', async () => {
    const repository = crearRepository({
      isConfigured: jest.fn().mockResolvedValue(false),
    });
    const useCase = new GuardarConfiguracionSireUseCase(repository);

    await expect(
      useCase.execute(COMPANY_ID, { clientId: 'client-id' }),
    ).resolves.toEqual({ configured: false });
  });
});

describe('ConsultarEstadoConfiguracionSireUseCase', () => {
  it('answers that the company is configured', async () => {
    const repository = crearRepository({
      isConfigured: jest.fn().mockResolvedValue(true),
    });

    await expect(
      new ConsultarEstadoConfiguracionSireUseCase(repository).execute(COMPANY_ID),
    ).resolves.toEqual({ configured: true });
    expect(repository.isConfigured).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('answers that the company is not configured', async () => {
    const repository = crearRepository({
      isConfigured: jest.fn().mockResolvedValue(false),
    });

    await expect(
      new ConsultarEstadoConfiguracionSireUseCase(repository).execute(COMPANY_ID),
    ).resolves.toEqual({ configured: false });
  });
});
