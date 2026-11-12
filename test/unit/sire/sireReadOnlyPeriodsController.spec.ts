import {
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { ClientSafeHttpException } from '../../../src/common/exceptions';
import type { PrismaService } from '../../../src/database/prismaService';
import type { IUserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import type { SolCredentialCipherPort } from '../../../src/modules/auth/domain/ports/solCredentialCipherPort';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SireReadOnlyPeriodsController } from '../../../src/modules/sire/infrastructure/controllers/sireReadOnlyPeriodsController';
import type { SireReadOnlyPeriodsClient } from '../../../src/modules/sire/infrastructure/sunat/sireReadOnlyPeriodsClient';

describe('SireReadOnlyPeriodsController', () => {
  let logError: jest.SpyInstance;

  const company = {
    id: 'company-id',
    ruc: '20100070970',
    isActive: true,
  };
  const users = {
    findCompanyById: jest.fn(),
  } as unknown as IUserRepositoryPort;
  const sireClient = {
    assertConfigured: jest.fn(),
  } as unknown as SireReadOnlyPeriodsClient;
  const prisma = {
    sirePeriodQuery: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
  const queue = {
    enqueueSirePeriods: jest.fn(),
  } as unknown as QueueService;
  const credentialCipher = {
    encrypt: jest.fn(() => 'opaque-encrypted-credentials'),
    decrypt: jest.fn(),
  } as unknown as SolCredentialCipherPort;
  const controller = new SireReadOnlyPeriodsController(
    users,
    sireClient,
    prisma,
    queue,
    credentialCipher,
  );
  const dto = {
    bookCode: '140000' as const,
    solUser: 'FAKEUSER',
    solPassword: 'fake-sol-password',
  };
  const user = {
    sub: 'user-id',
    email: 'demo@example.test',
    companyId: 'company-id',
    role: 'ADMIN',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    (users.findCompanyById as jest.Mock).mockResolvedValue(company);
    (prisma.sirePeriodQuery.create as jest.Mock).mockResolvedValue({});
    (queue.enqueueSirePeriods as jest.Mock).mockResolvedValue('job-id');
  });

  afterEach(() => {
    logError.mockRestore();
  });

  it('creates a pending job using tenant RUC and encrypts SOL credentials in the payload', async () => {
    const response = await controller.getPeriods(dto, user);

    expect(response).toMatchObject({ status: 'PENDING' });
    expect(response.messageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(users.findCompanyById).toHaveBeenCalledWith(user.companyId);
    expect(sireClient.assertConfigured).toHaveBeenCalled();
    expect(credentialCipher.encrypt).toHaveBeenCalledWith(
      JSON.stringify({
        solUser: dto.solUser,
        solPassword: dto.solPassword,
      }),
    );
    expect(prisma.sirePeriodQuery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: response.messageId,
        company_id: company.id,
        book_code: dto.bookCode,
      }),
    });

    const queuedPayload = (queue.enqueueSirePeriods as jest.Mock).mock
      .calls[0][0];
    expect(queuedPayload).toMatchObject({
      messageId: response.messageId,
      companyId: company.id,
      ruc: company.ruc,
      bookCode: dto.bookCode,
      encryptedSolCredentials: 'opaque-encrypted-credentials',
    });
    expect(queuedPayload.encryptedSolCredentials).not.toContain(
      dto.solPassword,
    );
    expect(queuedPayload.encryptedSolCredentials).not.toContain(dto.solUser);
  });

  it('rejects requests without an authenticated tenant', async () => {
    await expect(controller.getPeriods(dto, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(users.findCompanyById).not.toHaveBeenCalled();
  });

  it('rejects requests of a session without company', async () => {
    await expect(
      controller.getPeriods(dto, {
        ...user,
        companyId: undefined as unknown as string,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findCompanyById).not.toHaveBeenCalled();
  });

  it('rejects missing or inactive companies without enqueueing', async () => {
    (users.findCompanyById as jest.Mock).mockResolvedValueOnce(null);
    await expect(controller.getPeriods(dto, user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(queue.enqueueSirePeriods).not.toHaveBeenCalled();

    (users.findCompanyById as jest.Mock).mockResolvedValueOnce({
      ...company,
      isActive: false,
    });
    await expect(controller.getPeriods(dto, user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(queue.enqueueSirePeriods).not.toHaveBeenCalled();
  });

  it('does not enqueue while the integration is disabled', async () => {
    (sireClient.assertConfigured as jest.Mock).mockImplementationOnce(() => {
      throw new ServiceUnavailableException('disabled');
    });

    await expect(controller.getPeriods(dto, user)).rejects.toBeInstanceOf(
      ClientSafeHttpException,
    );
    expect(prisma.sirePeriodQuery.create).not.toHaveBeenCalled();
    expect(queue.enqueueSirePeriods).not.toHaveBeenCalled();
  });

  it('answers with a controlled JSON when the queue is unavailable', async () => {
    (queue.enqueueSirePeriods as jest.Mock).mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    );

    const response = await controller.getPeriods(dto, user);

    expect(response).toMatchObject({
      status: 'FAILED',
      errorCode: 'QUEUE_ENQUEUE_FAILED',
      message: 'El servicio de colas no está disponible, por favor reintenta.',
      error: 'El servicio de colas no está disponible, por favor reintenta.',
    });
    expect(response.messageId).toEqual(expect.any(String));
    expect(prisma.sirePeriodQuery.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({
        status: 'FAILED',
        error_code: 'QUEUE_ENQUEUE_FAILED',
      }),
    });
  });

  it('keeps the 202 status when the queue is unavailable', () => {
    const httpCode = Reflect.getMetadata(
      HTTP_CODE_METADATA,
      SireReadOnlyPeriodsController.prototype.getPeriods,
    );

    expect(httpCode).toBe(HttpStatus.ACCEPTED);
  });

  it('answers the controlled 202 when the queue does not respond in time', async () => {
    jest.useFakeTimers();
    (queue.enqueueSirePeriods as jest.Mock).mockReturnValueOnce(
      new Promise(() => undefined),
    );

    const pending = controller.getPeriods(dto, user);
    await jest.advanceTimersByTimeAsync(20_000);
    const response = await pending;

    expect(response).toMatchObject({
      status: 'FAILED',
      errorCode: 'QUEUE_ENQUEUE_FAILED',
      message: 'El servicio de colas no está disponible, por favor reintenta.',
    });
    expect(response.messageId).toEqual(expect.any(String));
    jest.useRealTimers();
  });

  it('keeps the controlled answer when the failed state cannot be persisted', async () => {
    (queue.enqueueSirePeriods as jest.Mock).mockRejectedValueOnce(
      new Error('pg-boss caído'),
    );
    (prisma.sirePeriodQuery.update as jest.Mock).mockRejectedValueOnce(
      new Error('Connection terminated unexpectedly'),
    );

    const response = await controller.getPeriods(dto, user);

    expect(response.status).toBe('FAILED');
    expect(response.message).toBe(
      'El servicio de colas no está disponible, por favor reintenta.',
    );
  });

  it('does not expose infrastructure details when the queue fails', async () => {
    (queue.enqueueSirePeriods as jest.Mock).mockRejectedValueOnce(
      new Error('password authentication failed for user postgres'),
    );

    const response = await controller.getPeriods(dto, user);

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('password authentication failed');
    expect(serialized).not.toContain('postgres');
  });

  it('answers with a controlled JSON when the query cannot be persisted', async () => {
    (prisma.sirePeriodQuery.create as jest.Mock).mockRejectedValueOnce(
      new Error('connection to server at 127.0.0.1 port 5432 failed'),
    );

    const failure = await controller
      .getPeriods(dto, user)
      .then(() => null)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ClientSafeHttpException);
    const controlled = failure as ClientSafeHttpException;
    expect(controlled.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(controlled.clientMessage).toBe(
      'No fue posible registrar la consulta de períodos SIRE. Inténtalo nuevamente.',
    );
    expect(JSON.stringify(controlled.getResponse())).not.toContain('5432');
    expect(queue.enqueueSirePeriods).not.toHaveBeenCalled();
  });

  it('returns completed results only to the requesting tenant', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'COMPLETED',
      result: '{"periodos":["202601"]}',
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    await expect(
      controller.getStatus('c5a31a3d-460a-46e7-9a3e-9057a31d0098', user),
    ).resolves.toMatchObject({
      status: 'COMPLETED',
      periods: { periodos: ['202601'] },
    });
    expect(prisma.sirePeriodQuery.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
        company_id: user.companyId,
      },
    });
  });

  it('does not reveal a request belonging to a different tenant', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      controller.getStatus('c5a31a3d-460a-46e7-9a3e-9057a31d0098', user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a status query without an authenticated tenant', async () => {
    await expect(
      controller.getStatus('c5a31a3d-460a-46e7-9a3e-9057a31d0098', undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.sirePeriodQuery.findFirst).not.toHaveBeenCalled();
  });

  it('answers a generic message for a failure code that is not catalogued', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'FAILED',
      result: null,
      error_code: 'CODIGO_DESCONOCIDO',
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    const response = await controller.getStatus(
      'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      user,
    );

    expect(response).toMatchObject({
      status: 'FAILED',
      errorCode: 'CODIGO_DESCONOCIDO',
      message:
        'No se pudo completar la consulta de períodos SIRE. Inténtalo más tarde.',
    });
    expect(JSON.stringify(response)).not.toContain('Internal Server Error');
  });

  it('returns a friendly message when the SUNAT query failed', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'FAILED',
      result: null,
      error_code: 'SUNAT_HTTP_502',
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    const response = await controller.getStatus(
      'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      user,
    );

    expect(response).toMatchObject({
      status: 'FAILED',
      errorCode: 'SUNAT_HTTP_502',
      message: 'El servicio de SUNAT no está disponible temporalmente. Inténtalo más tarde.',
      error: 'El servicio de SUNAT no está disponible temporalmente. Inténtalo más tarde.',
    });
    expect(JSON.stringify(response)).not.toContain('Internal Server Error');
  });

  it('explains credential problems without exposing SUNAT internals', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'FAILED',
      result: null,
      error_code: 'SUNAT_AUTH_FAILED',
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    const response = await controller.getStatus(
      'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      user,
    );

    expect(response).toMatchObject({
      status: 'FAILED',
      errorCode: 'SUNAT_AUTH_FAILED',
      message: 'SUNAT rechazó las credenciales SOL. Verifica el usuario y la clave.',
    });
  });

  it('informs the same queue message in the status endpoint', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'FAILED',
      result: null,
      error_code: 'QUEUE_ENQUEUE_FAILED',
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    const response = await controller.getStatus(
      'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      user,
    );

    expect(response).toMatchObject({
      status: 'FAILED',
      errorCode: 'QUEUE_ENQUEUE_FAILED',
      message: 'El servicio de colas no está disponible, por favor reintenta.',
      error: 'El servicio de colas no está disponible, por favor reintenta.',
    });
  });

  it('does not fail when the stored result cannot be parsed', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'COMPLETED',
      result: '{periodos:',
      error_code: null,
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    const response = await controller.getStatus(
      'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      user,
    );

    expect(response).toMatchObject({ status: 'COMPLETED' });
    expect(response['periods']).toBeUndefined();
  });

  it('warns when a completed query has no stored result', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'COMPLETED',
      result: null,
      error_code: null,
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    const response = await controller.getStatus(
      'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      user,
    );

    expect(response).toMatchObject({
      status: 'COMPLETED',
      message:
        'La consulta se completó, pero no fue posible leer el resultado almacenado.',
    });
    expect(response['periods']).toBeUndefined();
  });

  it('answers a failed query without an error code', async () => {
    (prisma.sirePeriodQuery.findFirst as jest.Mock).mockResolvedValue({
      id: 'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      company_id: user.companyId,
      book_code: '140000',
      status: 'FAILED',
      result: null,
      error_code: null,
      created_at: new Date('2026-11-08T12:00:00Z'),
      completed_at: new Date('2026-11-08T12:01:00Z'),
    });

    const response = await controller.getStatus(
      'c5a31a3d-460a-46e7-9a3e-9057a31d0098',
      user,
    );

    expect(response).toMatchObject({
      status: 'FAILED',
      errorCode: null,
      message:
        'No se pudo completar la consulta de períodos SIRE. Inténtalo más tarde.',
    });
  });
});
