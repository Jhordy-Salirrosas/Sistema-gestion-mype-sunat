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
  SIRE_PERIOD_ERROR_CODES,
  type SirePeriodErrorCode,
} from '../../domain/rules/sirePeriodFailureMessages';
import {
  describeErrorSafely,
  redactSensitiveText,
} from '../../domain/rules/sireRedactionUtils';
import { classifySireSunatFailure } from '../sunat/sunatFailureClassifier';
import { SireTransportError } from '../sunat/sunatErrors';
/**
 * Import de VALOR (no `import type`): Nest lee el tipo de este parámetro en
 * los metadatos `design:paramtypes` para resolver la inyección. Con un
 * import de solo tipo el tipo se borra al compilar y el contenedor no
 * encuentra al cliente.
 */
import { SireReadOnlyPeriodsClient } from '../sunat/sireReadOnlyPeriodsClient';

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
    try {
      await this.runJob(job);
    } catch (error) {
      /**
       * AÚ NO SE TRAGA NADA.
       *
       * El único error que llega aquí es un fallo reintentable de SUNAT (que
       * `queryPeriods` relanza a propósito) o un fallo de base de datos. Los
       * dos deben volver a la cola: PgBoss los captura en su propio
       * `try/catch` —nunca se convierten en un rechazo no gestionado— y
       * reprograma el trabajo con backoff. Agotados los reintentos, el trabajo
       * llega a la DLQ y ahí se marca como FAILED.
       */
      this.logger.error(
        `No se pudo completar el trabajo de períodos SIRE (messageId=${job.messageId}): ${describeErrorSafely(error)}`,
      );
      throw error;
    }
  }

  /**
   * Cuerpo del trabajo.
   *
   * Va separado de `process` para que el clasificador de errores solo vea los
   * fallos de SUNAT y los de base de datos, nunca los de persistencia del
   * estado (que se aíslan en `markFailedSafely`).
   */
  private async runJob(job: SirePeriodsJobData): Promise<void> {
    const request = await this.prisma.sirePeriodQuery.findUnique({
      where: { id: job.messageId },
      include: { company: { select: { ruc: true, is_active: true } } },
    });

    if (!this.matchesRequestContext(request, job)) {
      await this.markFailedSafely(
        job.messageId,
        SIRE_PERIOD_ERROR_CODES.REQUEST_CONTEXT_INVALID,
      );
      return;
    }

    const credentials = this.readCredentials(job);
    if (!credentials) {
      await this.markFailedSafely(
        job.messageId,
        SIRE_PERIOD_ERROR_CODES.CREDENTIALS_UNAVAILABLE,
      );
      return;
    }

    await this.prisma.sirePeriodQuery.update({
      where: { id: job.messageId },
      data: { status: 'PROCESSING', error_code: null },
    });

    this.logger.log(
      `Iniciando consulta de períodos SIRE (messageId=${job.messageId}, libro=${job.bookCode})`,
    );

    const periods = await this.queryPeriods(job, credentials);
    if (periods === undefined) {
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

    this.logger.log(
      `Consulta de períodos SIRE completada con éxito (messageId=${job.messageId}, libro=${job.bookCode})`,
    );
  }

  /**
   * El trabajo solo se procesa si pertenece a la misma empresa, libro y RUC
   * que se registraron: cualquier diferencia es un trabajo que no debe
   * ejecutarse.
   */
  private matchesRequestContext(
    request: {
      company_id: string;
      book_code: string;
      company: { ruc: string; is_active: boolean };
    } | null,
    job: SirePeriodsJobData,
  ): boolean {
    if (!request) return false;
    if (request.company_id !== job.companyId) return false;
    if (request.book_code !== job.bookCode) return false;
    if (request.company.ruc !== job.ruc) return false;
    return request.company.is_active;
  }

  /**
   * Descifra las credenciales SOL dentro del worker.
   *
   * Devuelve `undefined` cuando no se pueden recuperar: el caso se marca como
   * fallido y no se intenta llamar a SUNAT.
   */
  private readCredentials(
    job: SirePeriodsJobData,
  ): SolCredentials | undefined {
    let decrypted: string;
    try {
      decrypted = this.credentialCipher.decrypt(job.encryptedSolCredentials);
    } catch {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decrypted) as unknown;
    } catch {
      return undefined;
    }

    if (!isSolCredentials(parsed)) {
      return undefined;
    }

    const solUser = parsed.solUser.trim();
    if (!solUser) {
      return undefined;
    }

    return { solUser, solPassword: parsed.solPassword };
  }

  /**
   * Consulta los períodos a SUNAT.
   *
   * Devuelve `undefined` cuando la consulta falla: el fallo ya quedó
   * persistido y, si es reintentable, la excepción se relanza para que PgBoss
   * reprograme el trabajo.
   */
  private async queryPeriods(
    job: SirePeriodsJobData,
    credentials: SolCredentials,
  ): Promise<unknown> {
    try {
      return await this.sireClient.getPeriods(
        job.ruc.trim(),
        credentials.solUser,
        credentials.solPassword,
        job.bookCode,
      );
    } catch (error) {
      const failure = classifySireSunatFailure(error);
      this.logger.error(
        `Error controlado al consultar períodos SIRE (messageId=${job.messageId}, libro=${job.bookCode}, causa=${failure.errorCode}): ${this.describeSunatError(error, credentials)}`,
      );
      /**
       * La solicitud queda FAILED desde el primer fallo para que el frontend
       * muestre un mensaje estable, y los fallos transitorios (500/502/red)
       * vuelven a la cola de PgBoss con backoff: un intento posterior puede
       * completarla y dejarla en COMPLETED.
       */
      await this.markFailedSafely(job.messageId, failure.errorCode);
      if (failure.retryable) {
        throw error;
      }
      return undefined;
    }
  }

  private async markRetriesExhausted(job: SirePeriodsJobData): Promise<void> {
    await this.markFailedSafely(
      job.messageId,
      SIRE_PERIOD_ERROR_CODES.SUNAT_RETRIES_EXHAUSTED,
    );
  }

  /**
   * Persiste el estado FAILED sin dejar que un fallo de base de datos tape el
   * error que se estaba explicando.
   *
   * ANTES DE ESTE CAMBIO
   *
   * `markFailed` se llamaba sin protección desde el `catch` de SUNAT. Si la
   * base de datos caía justo ahí, su error sustituía al de SUNAT: el trabajo
   * se relanzaba con el error equivocado (y el `throw` de reintento no se
   * llegaba a ejecutar), el estado se quedaba en PROCESSING para siempre y el
   * frontend terminaba en timeout sin saber por qué.
   */
  private async markFailedSafely(
    messageId: string,
    errorCode: SirePeriodErrorCode,
  ): Promise<void> {
    try {
      await this.markFailed(messageId, errorCode);
    } catch (error) {
      this.logger.error(
        `No se pudo marcar la consulta de períodos SIRE ${messageId} como ${errorCode}: ${describeErrorSafely(error)}`,
      );
    }
  }

  private async markFailed(
    messageId: string,
    errorCode: SirePeriodErrorCode,
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

  /**
   * Resumen del fallo para el log del servidor.
   *
   * Nunca incluye la clave SOL ni el usuario SOL: se redactan con la misma
   * utilidad que usa el cliente HTTP.
   */
  private describeSunatError(
    error: unknown,
    credentials: SolCredentials,
  ): string {
    const secrets = [credentials.solUser, credentials.solPassword];

    if (error instanceof SireTransportError) {
      return redactSensitiveText(error.diagnostic, secrets);
    }

    return describeErrorSafely(error, secrets);
  }
}
