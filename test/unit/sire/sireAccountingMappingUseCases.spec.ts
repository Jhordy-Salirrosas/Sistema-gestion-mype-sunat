import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ISireAccountingMappingRepositoryPort } from '../../../src/modules/sire/domain/ports/sireAccountingMappingRepositoryPort';
import { GetSireAccountingMappingsUseCase } from '../../../src/modules/sire/application/use-cases/getSireAccountingMappingsUseCase';
import { SaveSireAccountingMappingsUseCase } from '../../../src/modules/sire/application/use-cases/saveSireAccountingMappingsUseCase';

const COMPANY_ID = 'company-id';

function crearRepositorio() {
  return {
    findAll: jest.fn(),
    upsertMany: jest.fn(),
  } as unknown as ISireAccountingMappingRepositoryPort & {
    findAll: jest.Mock;
    upsertMany: jest.Mock;
  };
}

describe('GetSireAccountingMappingsUseCase', () => {
  it('returns the stored mappings', async () => {
    const repository = crearRepositorio();
    repository.findAll.mockResolvedValue([
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
    ]);
    const useCase = new GetSireAccountingMappingsUseCase(repository);

    await expect(useCase.execute(COMPANY_ID)).resolves.toEqual([
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
    ]);
    expect(repository.findAll).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('returns an empty list when the company has no mappings', async () => {
    const repository = crearRepositorio();
    repository.findAll.mockResolvedValue([]);
    const useCase = new GetSireAccountingMappingsUseCase(repository);

    await expect(useCase.execute(COMPANY_ID)).resolves.toEqual([]);
  });

  it('throws NotFound when the company does not exist', async () => {
    const repository = crearRepositorio();
    repository.findAll.mockResolvedValue(null);
    const useCase = new GetSireAccountingMappingsUseCase(repository);

    await expect(useCase.execute(COMPANY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SaveSireAccountingMappingsUseCase', () => {
  function crearCaso() {
    const repository = crearRepositorio();
    return {
      repository,
      useCase: new SaveSireAccountingMappingsUseCase(repository),
    };
  }

  it('normalizes and saves the mappings', async () => {
    const { repository, useCase } = crearCaso();
    repository.upsertMany.mockImplementation(
      async (_companyId: string, mappings: unknown) => mappings,
    );

    await expect(
      useCase.execute(COMPANY_ID, [
        { tipoOperacion: ' ventas ', cuentaContable: ' 701 ' },
        { tipoOperacion: 'igv', cuentaContable: '401' },
      ]),
    ).resolves.toEqual([
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      { tipoOperacion: 'IGV', cuentaContable: '401' },
    ]);
    expect(repository.upsertMany).toHaveBeenCalledWith(COMPANY_ID, [
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      { tipoOperacion: 'IGV', cuentaContable: '401' },
    ]);
  });

  it('deduplicates the same operation with the same account', async () => {
    const { repository, useCase } = crearCaso();
    repository.upsertMany.mockImplementation(
      async (_companyId: string, mappings: unknown) => mappings,
    );

    await expect(
      useCase.execute(COMPANY_ID, [
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
        { tipoOperacion: 'ventas', cuentaContable: '701' },
      ]),
    ).resolves.toEqual([
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
    ]);
  });

  it('rejects the same operation with different accounts', async () => {
    const { repository, useCase } = crearCaso();

    await expect(
      useCase.execute(COMPANY_ID, [
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
        { tipoOperacion: 'VENTAS', cuentaContable: '702' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertMany).not.toHaveBeenCalled();
  });

  it('rejects an empty array', async () => {
    const { repository, useCase } = crearCaso();

    await expect(useCase.execute(COMPANY_ID, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.upsertMany).not.toHaveBeenCalled();
  });

  it('rejects a payload that is not an array', async () => {
    const { repository, useCase } = crearCaso();

    await expect(
      useCase.execute(COMPANY_ID, null as unknown as []),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertMany).not.toHaveBeenCalled();
  });

  it('rejects blank operations or accounts', async () => {
    const { repository, useCase } = crearCaso();

    await expect(
      useCase.execute(COMPANY_ID, [
        { tipoOperacion: '  ', cuentaContable: '701' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.execute(COMPANY_ID, [
        { tipoOperacion: 'VENTAS', cuentaContable: '  ' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertMany).not.toHaveBeenCalled();
  });

  it('throws NotFound when the company does not exist', async () => {
    const { repository, useCase } = crearCaso();
    repository.upsertMany.mockResolvedValue(null);

    await expect(
      useCase.execute(COMPANY_ID, [
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
