import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { PrismaService } from '../../../src/database/prismaService';
import { HttpExceptionFilter } from '../../../src/common/filters';
import { TOKEN_SERVICE_PORT } from '../../../src/modules/auth/domain/ports/tokenServicePort';
import { USER_REPOSITORY_PORT } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import { SOL_CREDENTIAL_CIPHER } from '../../../src/modules/auth/domain/ports/solCredentialCipherPort';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SireReadOnlyPeriodsController } from '../../../src/modules/sire/infrastructure/controllers/sireReadOnlyPeriodsController';
import { SireReadOnlyPeriodsClient } from '../../../src/modules/sire/infrastructure/sunat/sireReadOnlyPeriodsClient';

/**
 * POR QUÉ EXISTE
 *
 * El frontend nunca debe recibir una página HTML ni el error interno de
 * PgBoss cuando la cola no puede publicar el trabajo. Esta prueba lo verifica
 * a nivel HTTP (estado, content-type y cuerpo), que es lo que el navegador
 * ve de verdad.
 */
describe('SIRE · consulta de períodos cuando la cola de PgBoss falla', () => {
  let app: INestApplication;
  const enqueueSirePeriods = jest.fn();
  const sirePeriodQuery = {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  };

  const body = {
    bookCode: '140000',
    solUser: 'USUARIO_SOL_FICTICIO',
    solPassword: 'CLAVE_SOL_FICTICIA',
  };

  const registrar = () =>
    request(app.getHttpServer())
      .post('/api/v1/sire/periodos')
      .set('Authorization', 'Bearer token-ficticio')
      .send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SireReadOnlyPeriodsController],
      providers: [
        AuthGuard,
        {
          provide: TOKEN_SERVICE_PORT,
          useValue: {
            verifyToken: jest.fn().mockReturnValue({
              sub: 'user',
              email: 'test@example.test',
              companyId: 'company-a',
              role: 'ADMIN',
            }),
          },
        },
        {
          provide: USER_REPOSITORY_PORT,
          useValue: {
            findCompanyById: jest
              .fn()
              .mockResolvedValue({
                id: 'company-a',
                ruc: '20100070970',
                isActive: true,
              }),
          },
        },
        {
          provide: SOL_CREDENTIAL_CIPHER,
          useValue: { encrypt: jest.fn(() => 'credenciales-cifradas') },
        },
        {
          provide: SireReadOnlyPeriodsClient,
          useValue: { assertConfigured: jest.fn() },
        },
        { provide: PrismaService, useValue: { sirePeriodQuery } },
        { provide: QueueService, useValue: { enqueueSirePeriods } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
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
    sirePeriodQuery.create.mockResolvedValue({});
    sirePeriodQuery.update.mockResolvedValue({});
    enqueueSirePeriods.mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    );
  });

  it('responde 202 con un JSON controlado cuando PgBoss no puede encolar', async () => {
    const response = await registrar();

    expect(response.status).toBe(202);
    expect(response.type).toBe('application/json');
    expect(response.body).toMatchObject({
      status: 'FAILED',
      errorCode: 'QUEUE_ENQUEUE_FAILED',
      message: 'El servicio de colas no está disponible, por favor reintenta.',
      error: 'El servicio de colas no está disponible, por favor reintenta.',
    });
    expect(response.body.messageId).toEqual(expect.any(String));
  });

  it('no filtra el error de infraestructura al frontend', async () => {
    const response = await registrar();

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('ECONNREFUSED');
    expect(serialized).not.toContain('5432');
    expect(serialized).not.toContain('pg-boss');
  });

  it('deja la consulta persistida como FAILED con su código de error', async () => {
    await registrar();

    expect(sirePeriodQuery.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({
        status: 'FAILED',
        error_code: 'QUEUE_ENQUEUE_FAILED',
      }),
    });
  });

  it('responde un JSON de error cuando la base de datos no registra la consulta', async () => {
    sirePeriodQuery.create.mockRejectedValueOnce(
      new Error('connection terminated unexpectedly'),
    );

    const response = await registrar();

    expect(response.status).toBe(500);
    expect(response.type).toBe('application/json');
    expect(response.body.message).toBe(
      'No fue posible registrar la consulta de períodos SIRE. Inténtalo nuevamente.',
    );
    expect(JSON.stringify(response.body)).not.toContain('connection terminated');
    expect(enqueueSirePeriods).not.toHaveBeenCalled();
  });
});
