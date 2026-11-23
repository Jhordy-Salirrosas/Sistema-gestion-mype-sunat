import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
} from '@nestjs/common/constants';
import { HttpStatus } from '@nestjs/common';
import { SireAccountingMappingController } from '../../../src/modules/sire/infrastructure/controllers/sireAccountingMappingController';
import { ROLES_KEY } from '../../../src/modules/auth/infrastructure/decorators/rolesDecorator';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
import type { GetSireAccountingMappingsUseCase } from '../../../src/modules/sire/application/use-cases/getSireAccountingMappingsUseCase';
import type { SaveSireAccountingMappingsUseCase } from '../../../src/modules/sire/application/use-cases/saveSireAccountingMappingsUseCase';

describe('SireAccountingMappingController', () => {
  const user = {
    sub: 'user-id',
    email: 'demo@example.test',
    companyId: 'company-id',
    role: 'ADMIN',
  };

  const getUseCase = {
    execute: jest.fn(),
  } as unknown as GetSireAccountingMappingsUseCase;
  const saveUseCase = {
    execute: jest.fn(),
  } as unknown as SaveSireAccountingMappingsUseCase;

  const controller = new SireAccountingMappingController(
    getUseCase,
    saveUseCase,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the mappings of the authenticated company', async () => {
    (getUseCase.execute as jest.Mock).mockResolvedValue([
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
    ]);

    await expect(controller.obtener(undefined, user)).resolves.toEqual([
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
    ]);
    expect(getUseCase.execute).toHaveBeenCalledWith('company-id');
  });

  it('lets an ADMIN read another company and keeps the token company otherwise', async () => {
    await controller.obtener('other-company', user);
    expect(getUseCase.execute).toHaveBeenLastCalledWith('other-company');

    await controller.obtener('other-company', { ...user, role: 'CONTADOR' });
    expect(getUseCase.execute).toHaveBeenLastCalledWith('company-id');
  });

  it('saves the mappings of the authenticated company', async () => {
    const mappings = [
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      { tipoOperacion: 'IGV', cuentaContable: '401' },
    ];
    (saveUseCase.execute as jest.Mock).mockResolvedValue(mappings);

    await expect(
      controller.guardar(mappings, undefined, user),
    ).resolves.toEqual(mappings);
    expect(saveUseCase.execute).toHaveBeenCalledWith('company-id', mappings);
  });

  it('accepts the multi-company envelope and lets an ADMIN target it', async () => {
    const mappings = [{ tipoOperacion: 'VENTAS', cuentaContable: '701' }];
    (saveUseCase.execute as jest.Mock).mockResolvedValue(mappings);

    await controller.guardar(
      { companyId: 'other-company', mappings },
      undefined,
      user,
    );

    expect(saveUseCase.execute).toHaveBeenCalledWith(
      'other-company',
      mappings,
    );
  });

  it('restricts the mapping to ADMIN with the roles guard', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, SireAccountingMappingController),
    ).toEqual(['ADMIN', 'ADMINISTRADOR']);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SireAccountingMappingController),
    ).toContain(RolesGuard);
  });

  it('answers 200 when the mappings are stored', () => {
    const httpCode = Reflect.getMetadata(
      HTTP_CODE_METADATA,
      SireAccountingMappingController.prototype.guardar,
    );

    expect(httpCode).toBe(HttpStatus.OK);
  });

  it('rejects an invalid mapping payload', async () => {
    await expect(
      controller.guardar({ companyId: 'company-id' }, undefined, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.guardar([{ tipoOperacion: 'VENTAS' }], undefined, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(saveUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects reads without company in the session', async () => {
    await expect(controller.obtener(undefined, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.obtener(undefined, { ...user, companyId: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects writes without company in the session', async () => {
    await expect(
      controller.guardar(
        [{ tipoOperacion: 'VENTAS', cuentaContable: '701' }],
        undefined,
        undefined,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.guardar([], undefined, {
        ...user,
        companyId: undefined as unknown as string,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(saveUseCase.execute).not.toHaveBeenCalled();
  });
});
