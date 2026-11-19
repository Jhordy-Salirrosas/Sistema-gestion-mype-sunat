import {
  INestApplication,
  ValidationPipe,
  type ExecutionContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { SireConfigurationController } from '../../../src/modules/sire/infrastructure/controllers/sireConfigurationController';
import { GuardarConfiguracionSireUseCase } from '../../../src/modules/sire/application/use-cases/guardarConfiguracionSireUseCase';
import { ConsultarEstadoConfiguracionSireUseCase } from '../../../src/modules/sire/application/use-cases/consultarEstadoConfiguracionSireUseCase';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';

const user = {
  sub: 'user-id',
  email: 'demo@example.test',
  companyId: 'company-id',
  role: 'ADMIN',
};

describe('SireConfigurationController HTTP', () => {
  let app: INestApplication<App>;
  const guardarUseCase = { execute: jest.fn() };
  const consultarEstadoUseCase = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SireConfigurationController],
      providers: [
        { provide: GuardarConfiguracionSireUseCase, useValue: guardarUseCase },
        {
          provide: ConsultarEstadoConfiguracionSireUseCase,
          useValue: consultarEstadoUseCase,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = user;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acepta las cuatro credenciales a través del ValidationPipe real', async () => {
    guardarUseCase.execute.mockResolvedValue({ configured: true });

    await request(app.getHttpServer())
      .post('/api/v1/sire/configuracion')
      .send({
        clientId: 'postman-test-client',
        clientSecret: 'postman-test-secret',
        solUser: 'POSTMAN_TEST',
        solPassword: 'postman-test-pass',
      })
      .expect(200)
      .expect({ configured: true });

    expect(guardarUseCase.execute).toHaveBeenCalledWith('company-id', {
      clientId: 'postman-test-client',
      clientSecret: 'postman-test-secret',
      solUser: 'POSTMAN_TEST',
      solPassword: 'postman-test-pass',
    });
  });

  it('rechaza el RUC y otras propiedades desconocidas', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sire/configuracion')
      .send({ companyId: 'otra-empresa' })
      .expect(400);

    expect(guardarUseCase.execute).not.toHaveBeenCalled();
  });
});
