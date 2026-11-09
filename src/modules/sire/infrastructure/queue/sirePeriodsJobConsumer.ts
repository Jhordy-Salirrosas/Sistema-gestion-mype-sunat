import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  SOL_CREDENTIAL_CIPHER,
  type SolCredentialCipherPort,
} from '../../../auth/domain/ports/solCredentialCipherPort';
import {
  QueueService,
  type SirePeriodsJobData,
} from '../../../resilience/infrastructure/queue/queue.service';
import {
  RetryableSireSunatError,
  SireTransportError,
  SireReadOnlyPeriodsClient,
} from '../sunat/sireReadOnlyPeriodsClient';

interface SolCredentials {
  solUser: string;
  solPassword: string;
}

function isSolCredentials(value: unknown): value is SolCredentials {
  if (value === null || typeof value !== 'object') return false;
  const credentials = value as Record<string, unknown>;
  return (
    typeof credentials['solUser'] === 'string' &&
    typeof credentials['solPassword'] === 'string'
  );
}

@Injectable()
export class SirePeriodsJobConsumer implements OnModuleInit {
  private readonly logger = new Logger(SirePeriodsJobConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly prisma: PrismaService,
    private readonly sireClient: SireReadOnlyPeriodsClient,
    @Inject(SOL_CREDENTIAL_CIPHER)
    private readonly credentialCipher: SolCredentialCipherPort,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Iniciando workers de consultas de períodos SIRE');
    await this.queue.registerSirePeriodsWorker((job) => this.process(job));
    await this.queue.registerSirePeriodsDlqWorker((job) =>
      this.markRetriesExhausted(job),
    );
    this.logger.log('Workers de consultas de períodos SIRE inicializados');
  }

  async process(job: SirePeriodsJobData): Promise<void> {
    const request = await this.prisma.sirePeriodQuery.findUnique({
      where: { id: job.messageId },
      include: { company: { select: { ruc: true, is_active: true } } },
    });

    if (
      !request ||
      request.company_id !== job.companyId ||
      request.book_code !== job.bookCode ||
      request.company.ruc !== job.ruc ||
      !request.company.is_active
    ) {
      await this.markFailed(job.messageId, 'REQUEST_CONTEXT_INVALID');
      return;
    }

    let credentials: SolCredentials;
    try {
      credentials = JSON.parse(
        this.credentialCipher.decrypt(job.encryptedSolCredentials),
      ) as SolCredentials;
    } catch {
      await this.markFailed(job.messageId, 'CREDENTIALS_UNAVAILABLE');
      return;
    }
    if (!isSolCredentials(credentials)) {
      await this.markFailed(job.messageId, 'CREDENTIALS_UNAVAILABLE');
      return;
    }
    credentials = {
      solUser: credentials.solUser.trim(),
      solPassword: credentials.solPassword,
    };
    if (!credentials.solUser) {
      await this.markFailed(job.messageId, 'CREDENTIALS_UNAVAILABLE');
      return;
    }

    const username = `${job.ruc.trim()}${credentials.solUser}`;
    const usernamePrefix = username.match(/^\d{1,4}/)?.[0] ?? 'N/A';
    this.logger.log(
      `Diagnóstico autenticación SIRE: companyId=${job.companyId}, username inicia con=${usernamePrefix}..., username chars=${username.length}, password chars=${credentials.solPassword.length}`,
    );

    await this.prisma.sirePeriodQuery.update({
      where: { id: job.messageId },
      data: { status: 'PROCESSING', error_code: null },
    });

    let periods: unknown;
    try {
      periods = await this.sireClient.getPeriods(
        job.ruc,
        credentials.solUser,
        credentials.solPassword,
        job.bookCode,
      );
    } catch (error) {
      this.logger.error(
        `Falló la consulta SUNAT de períodos (messageId=${job.messageId}, libro=${job.bookCode}): ${this.describeSunatError(error, credentials)}`,
      );
      if (error instanceof RetryableSireSunatError) {
        await this.prisma.sirePeriodQuery.update({
          where: { id: job.messageId },
          data: {
            status: 'PENDING',
            error_code: `SUNAT_HTTP_${error.sunatStatus}`,
          },
        });
        throw error;
      }

      await this.markFailed(job.messageId, 'SUNAT_REQUEST_FAILED');
      return;
    }

    await this.prisma.sirePeriodQuery.update({
      where: { id: job.messageId },
      data: {
        status: 'COMPLETED',
        result: JSON.stringify(periods),
        error_code: null,
        completed_at: new Date(),
      },
    });
  }

  private async markRetriesExhausted(job: SirePeriodsJobData): Promise<void> {
    await this.markFailed(job.messageId, 'SUNAT_RETRIES_EXHAUSTED');
  }

  private async markFailed(
    messageId: string,
    errorCode: string,
  ): Promise<void> {
    await this.prisma.sirePeriodQuery.updateMany({
      where: { id: messageId, status: { not: 'COMPLETED' } },
      data: {
        status: 'FAILED',
        error_code: errorCode,
        completed_at: new Date(),
      },
    });
  }

  private describeSunatError(
    error: unknown,
    credentials: SolCredentials,
  ): string {
    if (error instanceof SireTransportError) {
      return error.diagnostic;
    }

    if (!(error instanceof Error)) {
      return 'Error desconocido';
    }

    let message = error.message;
    for (const secret of [credentials.solUser, credentials.solPassword]) {
      if (secret) message = message.split(secret).join('[REDACTED]');
    }
    message = message
      .replace(/bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
      .replace(
        /\b(password|client_secret|access_token|authorization)\s*[:=]\s*([^\s,;&]+)/gi,
        '$1=[REDACTED]',
      );

    const metadata = error as Error & { code?: unknown; status?: unknown };
    const code =
      typeof metadata.code === 'string' ? ` code=${metadata.code}` : '';
    const status =
      typeof metadata.status === 'number' ? ` status=${metadata.status}` : '';
    return `${error.name}${status}${code}: ${message.slice(0, 500)}`;
  }
}
