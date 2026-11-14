import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../../../../common/decorators';
import { ClientSafeHttpException } from '../../../../common/exceptions';
import { PrismaService } from '../../../../database/prismaService';
import {
  USER_REPOSITORY_PORT,
  type IUserRepositoryPort,
} from '../../../auth/domain/ports/userRepositoryPort';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { QueueService, type SirePeriodsJobData } from '../../../resilience/infrastructure/queue/queue.service';
import { SirePeriodsRequestDto } from '../../application/dto/sirePeriodsRequestDto';
import {
  friendlySireFailureMessage,
  SIRE_NOT_AVAILABLE_MESSAGE,
  SIRE_PERIOD_ERROR_CODES,
  SIRE_QUEUE_UNAVAILABLE_MESSAGE,
  SIRE_REQUEST_STORE_FAILED_MESSAGE,
} from '../../domain/rules/sirePeriodFailureMessages';
import { describeErrorSafely } from '../../domain/rules/sireRedactionUtils';
import { SireReadOnlyPeriodsClient } from '../sunat/sireReadOnlyPeriodsClient';

/**
 * Estado que devuelve el registro de una consulta de períodos.
 *
 * `FAILED` no es un estado de la tabla `sire_period_queries`: es el estado
 * controlado que el controlador entrega cuando la INFRAESTRUCTURA (la cola de
 * PgBoss) no permite publicar el trabajo.
 *
 * POR QUÉ NO ES UN 5XX
 *
 * Un 503 o un 500 genérico se cumplen igual en la respuesta: el proxy o el
 * hosting pueden reemplazar el cuerpo por su propia página HTML de error y el
 * frontend se queda sin JSON que interpretar. Devolviendo HTTP 202 con el
 * estado `FAILED` el frontend recibe SIEMPRE un JSON estructurado, con el
 * `messageId` que le permite consultar el estado y con el mensaje accionable
 * ya escrito.
 */
export type SirePeriodsRequestStatus = 'PENDING' | 'FAILED';

/** Cuerpo que el frontend recibe al registrar una consulta de períodos. */
export interface SirePeriodsRequestResponse {
  messageId: string;
  status: SirePeriodsRequestStatus;
  /** Código estable del fallo; el frontend lo usa para decidir si reintenta. */
  errorCode?: string;
  /** Texto accionable para mostrar tal cual. */
  message?: string;
  /** Se conserva con el mismo valor que `message` por compatibilidad. */
  error?: string;
}

/**
 * Tope de espera del encolado. Es generoso a propósito: encolar es insertar
 * una fila, no hacer un trabajo lento.
 */
const SIRE_ENQUEUE_TIMEOUT_MS = 15_000;

/** Empresa de la sesión con los datos que la consulta necesita. */
interface RequestCompany {
  id: string;
  ruc: string;
}

@Controller('api/v1/sire')
@UseGuards(AuthGuard)
export class SireReadOnlyPeriodsController {
  private readonly logger = new Logger(SireReadOnlyPeriodsController.name);

  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: IUserRepositoryPort,
    private readonly sireClient: SireReadOnlyPeriodsClient,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  @Post('periodos')
  @HttpCode(HttpStatus.ACCEPTED)
  async getPeriods(
    @Body() dto: SirePeriodsRequestDto,
    @CurrentUser() user?: TokenPayload,
  ): Promise<SirePeriodsRequestResponse> {
    const company = await this.resolveCompany(user);
    this.assertIntegrationEnabled();

    const messageId = randomUUID();
    await this.registerQuery(messageId, company, dto);

    return this.enqueueQuery(messageId, company, dto);
  }

  @Get('periodos/status/:messageId')
  async getStatus(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentUser() user?: TokenPayload,
  ): Promise<Record<string, unknown>> {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }

    /**
     * Solo lectura de base de datos: el estado se resuelve sin llamar a SUNAT
     * para que el frontend pueda consultar rápido sin castigar la API.
     */
    const query = await this.prisma.sirePeriodQuery.findFirst({
      where: { id: messageId, company_id: user.companyId },
    });
    if (!query) {
      throw new NotFoundException('No se encontró la solicitud SIRE.');
    }

    const failed = query.status === 'FAILED';
    const periods =
      query.status === 'COMPLETED'
        ? this.parseStoredResult(query.result)
        : undefined;
    const message = failed
      ? friendlySireFailureMessage(query.error_code)
      : undefined;
    const unreadableResult =
      query.status === 'COMPLETED' && periods === undefined;

    return {
      messageId: query.id,
      status: query.status,
      bookCode: query.book_code,
      ...(periods === undefined ? {} : { periods }),
      /**
       * `message` es el texto que el frontend muestra; `error` se conserva
       * con el mismo valor para no romper consumidores previos.
       */
      ...(failed
        ? { message, error: message, errorCode: query.error_code ?? null }
        : {}),
      ...(unreadableResult
        ? {
            message:
              'La consulta se completó, pero no fue posible leer el resultado almacenado.',
          }
        : {}),
      createdAt: query.created_at,
      completedAt: query.completed_at,
    };
  }

  /**
   * Empresa activa de la sesión.
   *
   * El RUC sale de aquí y nunca del cuerpo de la solicitud: el cliente no
   * puede consultar períodos de otra empresa.
   */
  private async resolveCompany(
    user?: TokenPayload,
  ): Promise<RequestCompany> {
    if (!user?.companyId) {
      throw new UnauthorizedException(
        'La empresa del usuario no está definida.',
      );
    }

    const company = await this.users.findCompanyById(user.companyId);
    if (!company || !company.isActive) {
      throw new NotFoundException(
        'No se encontró una empresa activa para la sesión.',
      );
    }

    return { id: company.id, ruc: company.ruc };
  }

  /**
   * Si la integración no está habilitada en el entorno, el frontend recibe
   * un texto claro en lugar del 503 genérico del filtro global.
   */
  private assertIntegrationEnabled(): void {
    try {
      this.sireClient.assertConfigured();
    } catch (error) {
      this.logger.error(
        `La consulta de períodos SIRE no está operativa: ${describeErrorSafely(error)}`,
      );
      throw new ClientSafeHttpException(
        HttpStatus.SERVICE_UNAVAILABLE,
        SIRE_NOT_AVAILABLE_MESSAGE,
      );
    }
  }

  /**
   * Registra la consulta.
   *
   * NO se guardan credenciales aquí: las resuelve el worker desde
   * `sire_configurations` usando el `companyId` de la empresa.
   *
   * Si la base de datos no responde no hay `messageId` consultable, así que la
   * respuesta tiene que ser un error controlado y no un estado `FAILED`.
   */
  private async registerQuery(
    messageId: string,
    company: RequestCompany,
    dto: SirePeriodsRequestDto,
  ): Promise<void> {
    try {
      await this.prisma.sirePeriodQuery.create({
        data: {
          id: messageId,
          company_id: company.id,
          job_id: messageId,
          book_code: dto.bookCode,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la consulta de períodos SIRE (messageId=${messageId}): ${describeErrorSafely(error)}`,
      );
      throw new ClientSafeHttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        SIRE_REQUEST_STORE_FAILED_MESSAGE,
        'Internal Server Error',
      );
    }
  }

  /**
   * Publica el trabajo en la cola.
   *
   * LA COLA ES INFRAESTRUCTURA
   *
   * El error original se registra solo en el log del servidor. Al cliente se
   * le devuelve un JSON controlado dentro del mismo HTTP 202: nunca una
   * traza, nunca un error de infraestructura y nunca una página HTML.
   *
   * La consulta queda `FAILED` con su código de error, de modo que
   * `GET /periodos/status/:messageId` informa del mismo fallo con el mismo
   * texto y el frontend tiene una única fuente de verdad.
   */
  private async enqueueQuery(
    messageId: string,
    company: RequestCompany,
    dto: SirePeriodsRequestDto,
  ): Promise<SirePeriodsRequestResponse> {
    try {
      await this.enqueueWithTimeout({
        messageId,
        companyId: company.id,
        ruc: company.ruc,
        bookCode: dto.bookCode,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo encolar la consulta de períodos SIRE (messageId=${messageId}): ${describeErrorSafely(error)}`,
      );
      await this.markQueryFailed(messageId);

      return {
        messageId,
        status: 'FAILED',
        errorCode: SIRE_PERIOD_ERROR_CODES.QUEUE_ENQUEUE_FAILED,
        message: SIRE_QUEUE_UNAVAILABLE_MESSAGE,
        error: SIRE_QUEUE_UNAVAILABLE_MESSAGE,
      };
    }

    return { messageId, status: 'PENDING' };
  }

  /**
   * Encola el trabajo con un tope de espera.
   *
   * POR QUÉ EL TOPE
   *
   * `boss.send` inserta una fila en PgBoss: si la base de datos está lenta o
   * bloqueada, la promesa puede quedarse pendiente indefinidamente y el
   * cliente se quedaría esperando un 202 que no llega nunca. Con el tope, la
   * respuesta 202 sale siempre (con el estado controlado `FAILED`), que es lo
   * que el frontend sabe manejar.
   */
  private async enqueueWithTimeout(payload: SirePeriodsJobData): Promise<string> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        this.queue.enqueueSirePeriods(payload),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error('La cola no respondió a tiempo.'));
          }, SIRE_ENQUEUE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Marca la consulta como fallida sin dejar que un segundo fallo (la misma
   * base de datos que acababa de fallar) sustituya la respuesta controlada
   * que el frontend debe recibir.
   */
  private async markQueryFailed(messageId: string): Promise<void> {
    try {
      await this.prisma.sirePeriodQuery.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          error_code: SIRE_PERIOD_ERROR_CODES.QUEUE_ENQUEUE_FAILED,
          completed_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo marcar la consulta de períodos SIRE ${messageId} como ${SIRE_PERIOD_ERROR_CODES.QUEUE_ENQUEUE_FAILED}: ${describeErrorSafely(error)}`,
      );
    }
  }

  /**
   * El resultado guardado es JSON produced por nosotros, pero un dato
   * corrupto no debe convertir una consulta completada en un error 500.
   */
  private parseStoredResult(result: string | null): unknown {
    if (!result) return undefined;
    try {
      return JSON.parse(result) as unknown;
    } catch {
      this.logger.error(
        'No se pudo leer el resultado almacenado de la consulta de períodos SIRE.',
      );
      return undefined;
    }
  }
}
