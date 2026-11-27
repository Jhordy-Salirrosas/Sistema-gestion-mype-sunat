import { UnauthorizedException } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { HttpStatus, RequestMethod } from '@nestjs/common';
import { SireConfigurationController } from '../../../src/modules/sire/infrastructure/controllers/sireConfigurationController';
import { ROLES_KEY } from '../../../src/modules/auth/infrastructure/decorators/rolesDecorator';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';
import type { ConsultarEstadoConfiguracionSireUseCase } from '../../../src/modules/sire/application/use-cases/consultarEstadoConfiguracionSireUseCase';
import type { GuardarConfiguracionSireUseCase } from '../../../src/modules/sire/application/use-cases/guardarConfiguracionSireUseCase';

describe('SireConfigurationController', () => {
  const user = {
    sub: 'user-id',
    email: 'demo@example.test',
    companyId: 'company-id',
    role: 'ADMIN',
  };

  const guardarUseCase = {
    execute: jest.fn(),
  } as unknown as GuardarConfiguracionSireUseCase;
  const consultarEstadoUseCase = {
    execute: jest.fn(),
  } as unknown as ConsultarEstadoConfiguracionSireUseCase;

  const controller = new SireConfigurationController(
    guardarUseCase,
    consultarEstadoUseCase,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves the credentials of the authenticated company', async () => {
    (guardarUseCase.execute as jest.Mock).mockResolvedValue({
      configured: true,
    });

    const dto = {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      solUser: 'FAKEUSER',
      solPassword: 'fake-sol-password',
    };

    await expect(controller.guardar(dto, user)).resolves.toEqual({
      success: true,
      message: 'Credenciales guardadas',
      configured: true,
      companyId: 'company-id',
    });
    expect(guardarUseCase.execute).toHaveBeenCalledWith('company-id', dto);
  });

  it('never takes the company from the body of the request', async () => {
    (guardarUseCase.execute as jest.Mock).mockResolvedValue({
      configured: true,
    });

    await controller.guardar(
      { clientId: 'client-id' } as never,
      user,
    );

    const [companyId] = (guardarUseCase.execute as jest.Mock).mock.calls[0];
    expect(companyId).toBe('company-id');
  });

  it('restricts the configuration to ADMIN with the roles guard', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, SireConfigurationController),
    ).toEqual(['ADMIN', 'ADMINISTRADOR']);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, SireConfigurationController),
    ).toContain(RolesGuard);
  });

  it('answers 200 when the configuration is stored', () => {
    const httpCode = Reflect.getMetadata(
      HTTP_CODE_METADATA,
      SireConfigurationController.prototype.guardar,
    );

    expect(httpCode).toBe(HttpStatus.OK);
  });

  it('exposes POST configuracion and GET configuracion/status', () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        SireConfigurationController.prototype.guardar,
      ),
    ).toBe('configuracion');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        SireConfigurationController.prototype.guardar,
      ),
    ).toBe(RequestMethod.POST);
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        SireConfigurationController.prototype.estado,
      ),
    ).toBe('configuracion/status');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        SireConfigurationController.prototype.estado,
      ),
    ).toBe(RequestMethod.GET);
  });

  it('rejects a session without company', async () => {
    await expect(
      controller.guardar({ clientId: 'client-id' }, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.guardar({ clientId: 'client-id' }, {
        ...user,
        companyId: undefined as unknown as string,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(guardarUseCase.execute).not.toHaveBeenCalled();
  });

  it('answers the state of the configuration of the authenticated company', async () => {
    (consultarEstadoUseCase.execute as jest.Mock).mockResolvedValue({
      configured: false,
    });

    await expect(controller.estado(undefined, user)).resolves.toEqual({
      configured: false,
    });
    expect(consultarEstadoUseCase.execute).toHaveBeenCalledWith('company-id');
  });

  it('lets an ADMIN target another company and keeps its own for non-admin', async () => {
    (guardarUseCase.execute as jest.Mock).mockResolvedValue({
      configured: true,
    });
    await controller.guardar(
      { clientId: 'client-id', companyId: 'other-company' },
      user,
    );
    expect(guardarUseCase.execute).toHaveBeenLastCalledWith(
      'other-company',
      expect.objectContaining({ companyId: 'other-company' }),
    );

    await controller.guardar(
      { clientId: 'client-id', companyId: 'other-company' },
      { ...user, role: 'CONTADOR' },
    );
    expect(guardarUseCase.execute).toHaveBeenLastCalledWith(
      'company-id',
      expect.objectContaining({ companyId: 'other-company' }),
    );
  });

  it('reads the status of the company requested by an ADMIN', async () => {
    (consultarEstadoUseCase.execute as jest.Mock).mockResolvedValue({
      configured: true,
    });

    await controller.estado('other-company', user);

    expect(consultarEstadoUseCase.execute).toHaveBeenCalledWith('other-company');
  });

  it('rejects the state query when the session has no company', async () => {
    await expect(controller.estado(undefined, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.estado(undefined, {
        ...user,
        companyId: undefined as unknown as string,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.estado(undefined, {
        ...user,
        companyId: '',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.estado()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.guardar({ clientId: 'client-id' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(consultarEstadoUseCase.execute).not.toHaveBeenCalled();
  });
});
