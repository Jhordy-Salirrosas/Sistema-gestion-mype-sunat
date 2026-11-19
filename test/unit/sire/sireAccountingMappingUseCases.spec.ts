import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ISireAccountingMappingRepositoryPort } from '../../../src/modules/sire/domain/ports/sireAccountingMappingRepositoryPort';
import { GetSireAccountingMappingsUseCase } from '../../../src/modules/sire/application/use-cases/getSireAccountingMappingsUseCase';
import { SaveSireAccountingMappingsUseCase } from '../../../src/modules/sire/application/use-cases/saveSireAccountingMappingsUseCase';
import type { ListAccountingAccountsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingAccountsUseCase';

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

function crearCuentas() {
  const cuentas = [
    ['121', 'Cuentas por cobrar comerciales'],
    ['401', 'IGV'],
    ['40111', 'IGV cuenta propia'],
    ['421', 'Cuentas por pagar comerciales'],
    ['601', 'Compras de mercaderías'],
    ['602', 'Compras'],
    ['701', 'Ventas de mercaderías'],
    ['702', 'Ventas'],
    ['703', 'Ventas varias'],
    ['422', 'Cuentas por pagar'],
    ['131', 'Clientes'],
  ].map(([code, name]) => ({
    code,
    name,
    element: '1',
    nature: 'Deudora' as const,
    parentCode: null,
    level: 3,
    isActive: true,
  }));

  return {
    execute: jest.fn().mockResolvedValue(cuentas),
  } as unknown as ListAccountingAccountsUseCase & { execute: jest.Mock };
}

describe('GetSireAccountingMappingsUseCase', () => {
  it('returns the stored mappings enriched with the real PCGE name', async () => {
    const repository = crearRepositorio();
    const accounts = crearCuentas();
    repository.findAll.mockResolvedValue([
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
    ]);
    const useCase = new GetSireAccountingMappingsUseCase(repository, accounts);

    await expect(useCase.execute(COMPANY_ID)).resolves.toEqual([
      {
        tipoOperacion: 'VENTAS',
        cuentaContable: '701',
        cuentaNombre: 'Ventas de mercaderías',
        cuentaActiva: true,
      },
    ]);
    expect(repository.findAll).toHaveBeenCalledWith(COMPANY_ID);
    expect(accounts.execute).toHaveBeenCalledWith(true);
  });

  it('marks a saved account that no longer exists in the PCGE', async () => {
    const repository = crearRepositorio();
    const accounts = crearCuentas();
    repository.findAll.mockResolvedValue([
      { tipoOperacion: 'VENTAS', cuentaContable: '999' },
    ]);
    const useCase = new GetSireAccountingMappingsUseCase(repository, accounts);

    await expect(useCase.execute(COMPANY_ID)).resolves.toEqual([
      {
        tipoOperacion: 'VENTAS',
        cuentaContable: '999',
        cuentaNombre: null,
        cuentaActiva: false,
      },
    ]);
  });

  it('returns an empty list when the company has no mappings', async () => {
    const repository = crearRepositorio();
    repository.findAll.mockResolvedValue([]);
    const useCase = new GetSireAccountingMappingsUseCase(
      repository,
      crearCuentas(),
    );

    await expect(useCase.execute(COMPANY_ID)).resolves.toEqual([]);
  });

  it('throws NotFound when the company does not exist', async () => {
    const repository = crearRepositorio();
    repository.findAll.mockResolvedValue(null);
    const useCase = new GetSireAccountingMappingsUseCase(
      repository,
      crearCuentas(),
    );

    await expect(useCase.execute(COMPANY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SaveSireAccountingMappingsUseCase', () => {
  function crearCaso() {
    const repository = crearRepositorio();
    const accounts = crearCuentas();
    return {
      repository,
      accounts,
      useCase: new SaveSireAccountingMappingsUseCase(repository, accounts),
    };
  }

  it('normalizes, validates against the PCGE and saves the mappings', async () => {
    const { repository, accounts, useCase } = crearCaso();
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
    expect(accounts.execute).toHaveBeenCalledWith(false);
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

  it('rejects an account that does not exist in the PCGE', async () => {
    const { repository, useCase } = crearCaso();

    await expect(
      useCase.execute(COMPANY_ID, [
        { tipoOperacion: 'VENTAS', cuentaContable: '999999' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertMany).not.toHaveBeenCalled();
  });

  it('rejects an inactive account of the PCGE', async () => {
    const { repository, accounts, useCase } = crearCaso();
    (accounts.execute as jest.Mock).mockResolvedValue([]);

    await expect(
      useCase.execute(COMPANY_ID, [
        { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertMany).not.toHaveBeenCalled();
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
