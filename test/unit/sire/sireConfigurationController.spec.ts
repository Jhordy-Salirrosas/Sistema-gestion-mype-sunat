import { UnauthorizedException } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { HttpStatus } from '@nestjs/common';
import { SireConfigurationController } from '../../../src/modules/sire/infrastructure/controllers/sireConfigurationController';
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
      configured: true,
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

  it('answers 200 when the configuration is stored', () => {
    const httpCode = Reflect.getMetadata(
      HTTP_CODE_METADATA,
      SireConfigurationController.prototype.guardar,
    );

    expect(httpCode).toBe(HttpStatus.OK);
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

    await expect(controller.estado(user)).resolves.toEqual({
      configured: false,
    });
    expect(consultarEstadoUseCase.execute).toHaveBeenCalledWith('company-id');
  });

  it('rejects the state query when the session has no company', async () => {
    await expect(controller.estado(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(consultarEstadoUseCase.execute).not.toHaveBeenCalled();
  });
});
