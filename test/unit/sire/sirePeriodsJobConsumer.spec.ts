import {
  BadGatewayException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PrismaService } from '../../../src/database/prismaService';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import type { ISireConfigurationRepositoryPort } from '../../../src/modules/sire/domain/ports/sireConfigurationRepositoryPort';
import { SirePeriodsJobConsumer } from '../../../src/modules/sire/infrastructure/queue/sirePeriodsJobConsumer';
import {
  RetryableSireSunatError,
  SireConfigurationError,
  SireTransportError,
  type SireReadOnlyPeriodsClient,
} from '../../../src/modules/sire/infrastructure/sunat/sireReadOnlyPeriodsClient';

describe('SirePeriodsJobConsumer', () => {
  let logError: jest.SpyInstance;
  let logInfo: jest.SpyInstance;

  const job = {
    messageId: 'message-id',
    companyId: 'company-id',
    ruc: '20100070970',
    bookCode: '140000' as const,
  };
  const request = {
    id: job.messageId,
    company_id: job.companyId,
    book_code: job.bookCode,
    company: { ruc: job.ruc, is_active: true },
  };
  const queue = {
    registerSirePeriodsWorker: jest.fn().mockResolvedValue('worker-id'),
    registerSirePeriodsDlqWorker: jest.fn().mockResolvedValue('dlq-worker-id'),
  } as unknown as QueueService;
  const prisma = {
    sirePeriodQuery: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;
  const sireClient = {
    getPeriods: jest.fn(),
  } as unknown as SireReadOnlyPeriodsClient;
  const configurationRepository = {
    findByCompanyId: jest.fn(),
    isConfigured: jest.fn(),
    save: jest.fn(),
  } as unknown as ISireConfigurationRepositoryPort;
  const consumer = new SirePeriodsJobConsumer(
    queue,
    prisma,
    sireClient,
    configurationRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    logInfo = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    (prisma.sirePeriodQuery.findUnique as jest.Mock).mockResolvedValue(request);
    (prisma.sirePeriodQuery.update as jest.Mock).mockResolvedValue({});
    (prisma.sirePeriodQuery.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (sireClient.getPeriods as jest.Mock).mockResolvedValue({
      periodos: ['202601'],
    });
    (configurationRepository.findByCompanyId as jest.Mock).mockResolvedValue({
      solUser: 'FAKEUSER',
      solPassword: 'fake-sol-password',
      clientId: 'fake-client-id',
      clientSecret: 'fake-client-secret',
    });
  });

  afterEach(() => {
    logError.mockRestore();
    logInfo.mockRestore();
  });

  it('registers the main and dead-letter workers', async () => {
    await consumer.onModuleInit();

    expect(queue.registerSirePeriodsWorker).toHaveBeenCalledTimes(1);
    expect(queue.registerSirePeriodsDlqWorker).toHaveBeenCalledTimes(1);
  });

  it('processes the job delivered by the registered worker', async () => {
    await consumer.onModuleInit();
    const workerHandler = (queue.registerSirePeriodsWorker as jest.Mock)
      .mock.calls[0][0] as (payload: typeof job) => Promise<void>;

    await workerHandler(job);

    expect(sireClient.getPeriods).toHaveBeenCalledWith(
      job.ruc,
      'FAKEUSER',
      'fake-sol-password',
      job.bookCode,
      { clientId: 'fake-client-id', clientSecret: 'fake-client-secret' },
    );
    expect(prisma.sirePeriodQuery.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('resolves the credentials of the company and persists the successful result', async () => {
    await consumer.process(job);

    expect(configurationRepository.findByCompanyId).toHaveBeenCalledWith(
      job.companyId,
    );
    expect(sireClient.getPeriods).toHaveBeenCalledWith(
      job.ruc,
      'FAKEUSER',
      'fake-sol-password',
      job.bookCode,
      { clientId: 'fake-client-id', clientSecret: 'fake-client-secret' },
    );
    expect(prisma.sirePeriodQuery.update).toHaveBeenLastCalledWith({
      where: { id: job.messageId },
      data: expect.objectContaining({
        status: 'COMPLETED',
        result: '{"periodos":["202601"]}',
        error_code: null,
        completed_at: expect.any(Date),
      }),
    });
  });

  it('never travels the credentials in the queued payload', async () => {
    await consumer.process(job);

    expect(job).not.toHaveProperty('encryptedSolCredentials');
    expect(Object.keys(job)).toEqual([
      'messageId',
      'companyId',
      'ruc',
      'bookCode',
    ]);
  });

  it('trims whitespace around the configured SOL username before requesting periods', async () => {
    (configurationRepository.findByCompanyId as jest.Mock).mockResolvedValueOnce({
      solUser: '  SIREAPII  ',
      solPassword: 'fake-sol-password',
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).toHaveBeenCalledWith(
      job.ruc,
      'SIREAPII',
      'fake-sol-password',
      job.bookCode,
      { clientId: undefined, clientSecret: undefined },
    );
  });

  it('falls back to the environment credentials when the company has none of its own', async () => {
    (configurationRepository.findByCompanyId as jest.Mock).mockResolvedValueOnce({
      solUser: 'FAKEUSER',
      solPassword: 'fake-sol-password',
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).toHaveBeenCalledWith(
      job.ruc,
      'FAKEUSER',
      'fake-sol-password',
      job.bookCode,
      { clientId: undefined, clientSecret: undefined },
    );
  });

  it('never logs credentials, token material or diagnostic fragments', async () => {
    (configurationRepository.findByCompanyId as jest.Mock).mockResolvedValueOnce({
      solUser: '  SIREAPII  ',
      solPassword: 'fake-sol-password',
      clientId: 'fake-client-id',
      clientSecret: 'fake-client-secret',
    });

    await consumer.process(job);

    const loggedMessages = [
      ...logInfo.mock.calls.flat(),
      ...logError.mock.calls.flat(),
    ].join(' ');

    expect(loggedMessages).toContain('Iniciando consulta de períodos SIRE');
    expect(loggedMessages).toContain('completada con éxito');
    expect(loggedMessages).not.toContain('fake-sol-password');
    expect(loggedMessages).not.toContain('fake-client-secret');
    expect(loggedMessages).not.toContain('SIREAPII');
    expect(loggedMessages).not.toContain('20100070970SIREAPII');
    expect(loggedMessages).not.toMatch(/chars=/);
    expect(loggedMessages).not.toMatch(/inicia con=/);
    expect(loggedMessages).not.toMatch(/password chars/);
  });

  it('marks the request failed and retries when SUNAT answers HTTP 500 or 502', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new RetryableSireSunatError(502),
    );

    await expect(consumer.process(job)).rejects.toBeInstanceOf(
      RetryableSireSunatError,
    );
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith({
      where: { id: job.messageId, status: { not: 'COMPLETED' } },
      data: {
        status: 'FAILED',
        error_code: 'SUNAT_HTTP_502',
        completed_at: expect.any(Date),
      },
    });
  });

  it('marks the request failed without retrying when SUNAT rejects the request', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new BadRequestException('SUNAT rechazó la solicitud.'),
    );

    await expect(consumer.process(job)).resolves.toBeUndefined();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith({
      where: { id: job.messageId, status: { not: 'COMPLETED' } },
      data: expect.objectContaining({
        status: 'FAILED',
        error_code: 'SUNAT_HTTP_400',
      }),
    });
  });

  it('keeps the retry when the failed state cannot be persisted', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new RetryableSireSunatError(502),
    );
    // La base de datos se cae justo al persistir el estado FAILED.
    (prisma.sirePeriodQuery.updateMany as jest.Mock).mockRejectedValueOnce(
      new Error('Connection terminated unexpectedly'),
    );

    // El error de SUNAT sigue siendo el que sale: el de la base de datos no lo
    // tapa y el trabajo vuelve a la cola como corresponde.
    await expect(consumer.process(job)).rejects.toBeInstanceOf(
      RetryableSireSunatError,
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo marcar la consulta de períodos SIRE'),
    );
  });

  it('does not leave the job rejected when the failed state cannot be persisted', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new BadRequestException('SUNAT rechazó la solicitud.'),
    );
    (prisma.sirePeriodQuery.updateMany as jest.Mock).mockRejectedValueOnce(
      new Error('Connection terminated unexpectedly'),
    );

    await expect(consumer.process(job)).resolves.toBeUndefined();
  });

  it('marks the request failed and retries when the SUNAT call times out', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new SireTransportError('TimeoutError: The operation was aborted'),
    );

    await expect(consumer.process(job)).rejects.toBeInstanceOf(
      SireTransportError,
    );
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith({
      where: { id: job.messageId, status: { not: 'COMPLETED' } },
      data: expect.objectContaining({
        status: 'FAILED',
        error_code: 'SUNAT_TIMEOUT',
      }),
    });
  });

  it('marks the request failed without retrying when the integration is not configured', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new SireConfigurationError('La integración API SIRE no está configurada.'),
    );

    await expect(consumer.process(job)).resolves.toBeUndefined();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith({
      where: { id: job.messageId, status: { not: 'COMPLETED' } },
      data: expect.objectContaining({
        status: 'FAILED',
        error_code: 'SIRE_NOT_CONFIGURED',
      }),
    });
  });

  it('marks non-retryable SUNAT errors as failed without exposing their details', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new ServiceUnavailableException('error with fake-sol-password'),
    );

    await expect(consumer.process(job)).resolves.toBeUndefined();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith({
      where: { id: job.messageId, status: { not: 'COMPLETED' } },
      data: {
        status: 'FAILED',
        error_code: 'SUNAT_UNAVAILABLE',
        completed_at: expect.any(Date),
      },
    });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[REDACTED]'),
    );
    expect(logError.mock.calls[0]?.[0]).not.toContain('fake-sol-password');
  });

  it('rejects a job whose tenant or RUC does not match the stored request', async () => {
    (prisma.sirePeriodQuery.findUnique as jest.Mock).mockResolvedValueOnce({
      ...request,
      company_id: 'another-company',
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error_code: 'REQUEST_CONTEXT_INVALID',
        }),
      }),
    );
  });

  it('marks the request failed after the PgBoss retry limit is exhausted', async () => {
    await consumer.onModuleInit();
    const deadLetterHandler = (queue.registerSirePeriodsDlqWorker as jest.Mock)
      .mock.calls[0][0] as (payload: typeof job) => Promise<void>;
    await deadLetterHandler(job);

    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: job.messageId, status: { not: 'COMPLETED' } },
        data: expect.objectContaining({
          status: 'FAILED',
          error_code: 'SUNAT_RETRIES_EXHAUSTED',
        }),
      }),
    );
  });

  it('marks the request failed when the company has no SIRE configuration', async () => {
    (configurationRepository.findByCompanyId as jest.Mock).mockResolvedValueOnce(
      null,
    );

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error_code: 'CREDENTIALS_UNAVAILABLE',
        }),
      }),
    );
  });

  it('marks the request failed when the configuration cannot be read', async () => {
    (configurationRepository.findByCompanyId as jest.Mock).mockRejectedValueOnce(
      new Error('Connection terminated unexpectedly'),
    );

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error_code: 'CREDENTIALS_UNAVAILABLE',
        }),
      }),
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo leer la configuración SIRE'),
    );
  });

  it('marks the request failed when the configuration has no SOL user', async () => {
    (configurationRepository.findByCompanyId as jest.Mock).mockResolvedValueOnce({
      solPassword: 'fake-sol-password',
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error_code: 'CREDENTIALS_UNAVAILABLE',
        }),
      }),
    );
  });

  it('marks the request failed when the configuration has no SOL password', async () => {
    (configurationRepository.findByCompanyId as jest.Mock).mockResolvedValueOnce({
      solUser: 'FAKEUSER',
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error_code: 'CREDENTIALS_UNAVAILABLE',
        }),
      }),
    );
  });

  it('marks the request failed when the SOL user is only whitespace', async () => {
    (configurationRepository.findByCompanyId as jest.Mock).mockResolvedValueOnce({
      solUser: '   ',
      solPassword: 'fake-sol-password',
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          error_code: 'CREDENTIALS_UNAVAILABLE',
        }),
      }),
    );
  });

  it('rejects a job whose book code does not match the stored request', async () => {
    (prisma.sirePeriodQuery.findUnique as jest.Mock).mockResolvedValueOnce({
      ...request,
      book_code: '080000',
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'REQUEST_CONTEXT_INVALID',
        }),
      }),
    );
  });

  it('rejects a job whose RUC does not match the stored request', async () => {
    (prisma.sirePeriodQuery.findUnique as jest.Mock).mockResolvedValueOnce({
      ...request,
      company: { ruc: '20123456789', is_active: true },
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'REQUEST_CONTEXT_INVALID',
        }),
      }),
    );
  });

  it('rejects a job of an inactive company', async () => {
    (prisma.sirePeriodQuery.findUnique as jest.Mock).mockResolvedValueOnce({
      ...request,
      company: { ruc: job.ruc, is_active: false },
    });

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'REQUEST_CONTEXT_INVALID',
        }),
      }),
    );
  });

  it('rejects a job whose request no longer exists', async () => {
    (prisma.sirePeriodQuery.findUnique as jest.Mock).mockResolvedValueOnce(
      null,
    );

    await consumer.process(job);

    expect(sireClient.getPeriods).not.toHaveBeenCalled();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'REQUEST_CONTEXT_INVALID',
        }),
      }),
    );
  });

  it('marks the request failed without retrying when SUNAT rejects the credentials', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new UnauthorizedException('SUNAT rechazó la autenticación SOL'),
    );

    await expect(consumer.process(job)).resolves.toBeUndefined();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'SUNAT_AUTH_FAILED',
        }),
      }),
    );
  });

  it('marks the request failed without retrying when SUNAT reports a validation error', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new UnprocessableEntityException('SUNAT reportó errores de validación'),
    );

    await expect(consumer.process(job)).resolves.toBeUndefined();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'SUNAT_HTTP_422',
        }),
      }),
    );
  });

  it('marks the request failed without retrying when SUNAT answers something unexpected', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new BadGatewayException('SUNAT devolvió una respuesta inesperada'),
    );

    await expect(consumer.process(job)).resolves.toBeUndefined();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'SUNAT_BAD_RESPONSE',
        }),
      }),
    );
  });

  it('marks the request failed without retrying when the failure is unknown', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new Error('fallo sin clasificar'),
    );

    await expect(consumer.process(job)).resolves.toBeUndefined();
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'SUNAT_REQUEST_FAILED',
        }),
      }),
    );
  });

  it('logs a transport failure that is not a timeout', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new SireTransportError('fetch failed: connect ECONNREFUSED 127.0.0.1:5432'),
    );

    await expect(consumer.process(job)).rejects.toBeInstanceOf(
      SireTransportError,
    );
    expect(prisma.sirePeriodQuery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'SUNAT_TRANSPORT_ERROR',
        }),
      }),
    );
    expect(logError.mock.calls.flat().join(' ')).toContain('ECONNREFUSED');
  });
});
