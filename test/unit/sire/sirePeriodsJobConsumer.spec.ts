import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../../src/database/prismaService';
import type { SolCredentialCipherPort } from '../../../src/modules/auth/domain/ports/solCredentialCipherPort';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';
import { SirePeriodsJobConsumer } from '../../../src/modules/sire/infrastructure/queue/sirePeriodsJobConsumer';
import {
  RetryableSireSunatError,
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
    encryptedSolCredentials: 'encrypted-fake-sol-credentials',
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
  const credentialCipher = {
    decrypt: jest.fn(() =>
      JSON.stringify({
        solUser: 'FAKEUSER',
        solPassword: 'fake-sol-password',
      }),
    ),
  } as unknown as SolCredentialCipherPort;
  const consumer = new SirePeriodsJobConsumer(
    queue,
    prisma,
    sireClient,
    credentialCipher,
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

  it('decrypts credentials only inside the worker and persists the successful result', async () => {
    await consumer.process(job);

    expect(credentialCipher.decrypt).toHaveBeenCalledWith(
      job.encryptedSolCredentials,
    );
    expect(sireClient.getPeriods).toHaveBeenCalledWith(
      job.ruc,
      'FAKEUSER',
      'fake-sol-password',
      job.bookCode,
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

  it('trims whitespace around the decrypted SOL username before requesting periods', async () => {
    (credentialCipher.decrypt as jest.Mock).mockReturnValueOnce(
      JSON.stringify({
        solUser: '  SIREAPII  ',
        solPassword: 'fake-sol-password',
      }),
    );

    await consumer.process(job);

    expect(sireClient.getPeriods).toHaveBeenCalledWith(
      job.ruc,
      'SIREAPII',
      'fake-sol-password',
      job.bookCode,
    );
  });

  it('logs only authentication metadata needed to diagnose tenant credentials', async () => {
    (credentialCipher.decrypt as jest.Mock).mockReturnValueOnce(
      JSON.stringify({
        solUser: '  SIREAPII  ',
        solPassword: 'fake-sol-password',
      }),
    );

    await consumer.process(job);

    expect(logInfo).toHaveBeenCalledWith(
      'Diagnóstico autenticación SIRE: companyId=company-id, username inicia con=2010..., username chars=19, password chars=17',
    );
    const loggedMessages = logInfo.mock.calls.flat().join(' ');
    expect(loggedMessages).not.toContain('20100070970SIREAPII');
    expect(loggedMessages).not.toContain('fake-sol-password');
  });

  it('throws only retryable SUNAT 500/502 failures back to PgBoss', async () => {
    (sireClient.getPeriods as jest.Mock).mockRejectedValueOnce(
      new RetryableSireSunatError(502),
    );

    await expect(consumer.process(job)).rejects.toBeInstanceOf(
      RetryableSireSunatError,
    );
    expect(prisma.sirePeriodQuery.update).toHaveBeenLastCalledWith({
      where: { id: job.messageId },
      data: { status: 'PENDING', error_code: 'SUNAT_HTTP_502' },
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
        error_code: 'SUNAT_REQUEST_FAILED',
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
});
