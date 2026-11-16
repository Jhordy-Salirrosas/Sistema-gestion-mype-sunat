import { UnauthorizedException } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { HttpStatus } from '@nestjs/common';
import { SireAccountingMappingController } from '../../../src/modules/sire/infrastructure/controllers/sireAccountingMappingController';
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

    await expect(controller.obtener(user)).resolves.toEqual([
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
    ]);
    expect(getUseCase.execute).toHaveBeenCalledWith('company-id');
  });

  it('saves the mappings of the authenticated company', async () => {
    const mappings = [
      { tipoOperacion: 'VENTAS', cuentaContable: '701' },
      { tipoOperacion: 'IGV', cuentaContable: '401' },
    ];
    (saveUseCase.execute as jest.Mock).mockResolvedValue(mappings);

    await expect(controller.guardar(mappings, user)).resolves.toEqual(
      mappings,
    );
    expect(saveUseCase.execute).toHaveBeenCalledWith('company-id', mappings);
  });

  it('answers 200 when the mappings are stored', () => {
    const httpCode = Reflect.getMetadata(
      HTTP_CODE_METADATA,
      SireAccountingMappingController.prototype.guardar,
    );

    expect(httpCode).toBe(HttpStatus.OK);
  });

  it('rejects reads without company in the session', async () => {
    await expect(controller.obtener(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.obtener({ ...user, companyId: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects writes without company in the session', async () => {
    await expect(
      controller.guardar(
        [{ tipoOperacion: 'VENTAS', cuentaContable: '701' }],
        undefined,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.guardar([], {
        ...user,
        companyId: undefined as unknown as string,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(saveUseCase.execute).not.toHaveBeenCalled();
  });
});
