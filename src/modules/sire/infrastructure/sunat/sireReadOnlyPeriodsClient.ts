import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  redactSensitiveText,
  redactSensitiveValue,
} from '../../domain/rules/sireRedactionUtils';
import {
  SireConfigurationError,
  SireTransportError,
  throwForSunatStatus,
  type SunatStatusMessages,
} from './sunatErrors';

/**
 * Los errores de SUNAT se reexportan aquí para no romper a quien ya los
 * importa desde el cliente.
 */
export {
  RetryableSireSunatError,
  SireConfigurationError,
  SireTransportError,
} from './sunatErrors';

export type SirePeriodBookCode = '140000' | '080000';

/**
 * Credenciales de API propias de una empresa.
 *
 * Si vienen informadas tienen prioridad sobre las variables de entorno: cada
 * contribuyente tiene su propio Client ID/Secret en la API SIRE de SUNAT.
 */
export interface SireClientCredentials {
  clientId?: string;
  clientSecret?: string;
}

export interface SireReadOnlyClientConfig {
  SIRE_AUTH_HOST?: string;
  SIRE_API_HOST?: string;
  SUNAT_CLIENT_ID?: string;
  SUNAT_CLIENT_SECRET?: string;
  SUNAT_SIRE_INTEGRATION_ENABLED?: string | boolean;
  SUNAT_SIRE_READONLY_TIMEOUT_MS?: string;
}

export interface ValidatedSireConfig {
  oauthBaseUrl: string;
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
}

type JsonRecord = Record<string, unknown>;
type FetchFunction = typeof fetch;
const SIRE_FETCHER = Symbol('SIRE_FETCHER');

const PERIOD_PATHS: Record<SirePeriodBookCode, string> = {
  '140000':
    '/v1/contribuyente/migeigv/libros/rvierce/padron/web/omisos/140000/periodos',
  '080000':
    '/v1/contribuyente/migeigv/libros/rce/padron/web/omisos/080000/periodos',
};

/** Host oficial de autenticación de SUNAT. */
const SUNAT_AUTH_HOST = 'api-seguridad.sunat.gob.pe';

/** Host oficial de la API SIRE de SUNAT. */
const SUNAT_API_HOST = 'api-sire.sunat.gob.pe';

const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 60000;

/** Identificadores de aplicación que son de ejemplo y no sirven en SUNAT. */
const PLACEHOLDER_CLIENT_ID_PATTERN =
  /^(tu-|your-|placeholder|inyectar-)|^<.*>$|sin-espacios$/i;

/** Mensajes de la consulta de períodos. */
const PERIODS_STATUS_MESSAGES: SunatStatusMessages = {
  unauthorized: 'SUNAT rechazó la autenticación SOL para esta consulta.',
  unprocessable: 'SUNAT reportó errores de validación para la consulta.',
  serviceUnavailable: 'SUNAT no pudo completar la consulta de períodos.',
};

/** Mensajes de la autenticación contra SUNAT. */
const TOKEN_STATUS_MESSAGES: SunatStatusMessages = {
  unauthorized: 'SUNAT rechazó la autenticación SOL para esta consulta.',
  unprocessable: 'SUNAT reportó errores de validación al autenticar la consulta.',
  serviceUnavailable: 'SUNAT no pudo completar la autenticación.',
};

function readJson(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

/**
 * Describe una parte del error de `fetch` sin filtrar secretos.
 *
 * `fetch` envuelve el fallo real en `cause`: el primer nivel dice "fetch
 * failed" y el segundo trae el código de red (ECONNREFUSED, ETIMEDOUT).
 */
function describeFetchFailure(record: JsonRecord): string {
  const name =
    typeof record['name'] === 'string' ? record['name'] : 'FetchError';
  const message =
    typeof record['message'] === 'string' ? record['message'] : '';
  const code = typeof record['code'] === 'string' ? record['code'] : '';

  return [name, code, message].filter(Boolean).join(': ').slice(0, 500);
}

/**
 * Extrae el diagnóstico del error de `fetch` conservando el código de red.
 *
 * El diagnóstico viaja dentro de `SireTransportError` y se registra en el log
 * del servidor: es la única forma de saber si fue un corte de red o un
 * tiempo de espera. Antes de salir de aquí pasa por la redacción común.
 */
function getFetchErrorDiagnostic(
  error: unknown,
  secrets: readonly string[],
): string {
  const details: string[] = [];
  let current = error;

  for (let depth = 0; depth < 2 && current !== undefined; depth += 1) {
    const record = readJson(current);
    if (!record) break;

    details.push(redactSensitiveText(describeFetchFailure(record), secrets));
    current = record['cause'];
  }

  return details.join(' <- ') || 'Error de transporte sin detalles';
}

@Injectable()
export class SireReadOnlyPeriodsClient {
  private readonly logger = new Logger(SireReadOnlyPeriodsClient.name);
  private readonly fetcher: FetchFunction;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(SIRE_FETCHER) fetcher?: FetchFunction,
  ) {
    this.fetcher = fetcher ?? globalThis.fetch;
  }

  async getPeriods(
    ruc: string,
    solUser: string,
    solPassword: string,
    bookCode: SirePeriodBookCode,
    credentials?: SireClientCredentials,
  ): Promise<unknown> {
    const config = this.getValidatedConfig(credentials);
    const normalizedRuc = ruc.trim();
    const normalizedSolUser = solUser.trim();
    if (!normalizedRuc || !normalizedSolUser) {
      throw new BadRequestException(
        'El RUC y el usuario SOL son obligatorios para la consulta.',
      );
    }

    const username = `${normalizedRuc}${normalizedSolUser}`;
    const secrets = [
      username,
      `${ruc}${solUser}`,
      solPassword,
      solUser,
      config.clientSecret,
      config.clientId,
    ];
    this.logger.log(`Iniciando consulta de períodos SIRE (libro=${bookCode})`);

    const response = await this.requestPeriodsWithTokenRefresh(
      config,
      username,
      solPassword,
      bookCode,
      secrets,
    );

    await this.assertPeriodsResponse(response);

    return redactSensitiveValue(await this.parseJson(response), secrets);
  }

  assertConfigured(): void {
    this.getValidatedConfig();
  }

  /**
   * Pide un token y consulta los períodos. Si SUNAT responde 401, renueva el
   * token una sola vez: el token puede haber caducado entre la autenticación
   * y la lectura.
   */
  private async requestPeriodsWithTokenRefresh(
    config: ValidatedSireConfig,
    username: string,
    solPassword: string,
    bookCode: SirePeriodBookCode,
    secrets: string[],
  ): Promise<Response> {
    const accessToken = await this.requestAccessToken(
      config,
      username,
      solPassword,
    );
    secrets.push(accessToken);

    const response = await this.requestPeriods(config, bookCode, accessToken);
    if (response.status !== 401) {
      return response;
    }

    const refreshedToken = await this.requestAccessToken(
      config,
      username,
      solPassword,
    );
    secrets.push(refreshedToken);

    return this.requestPeriods(config, bookCode, refreshedToken);
  }

  /**
   * Traduce la respuesta de SUNAT a una excepción.
   *
   * El 422 se trata aparte porque su cuerpo lleva el número de errores de
   * validación que se muestra al usuario.
   */
  private async assertPeriodsResponse(response: Response): Promise<void> {
    if (response.status === 422) {
      const body = readJson(await this.parseJson(response));
      const errors = Array.isArray(body?.['errors']) ? body['errors'] : [];
      throw new UnprocessableEntityException({
        message: 'SUNAT reportó errores de validación para la consulta.',
        errorCount: errors.length,
      });
    }

    throwForSunatStatus(response, PERIODS_STATUS_MESSAGES);
  }

  private getValidatedConfig(
    credentials?: SireClientCredentials,
  ): ValidatedSireConfig {
    this.assertIntegrationEnabled();

    const clientId = this.readClientId(credentials?.clientId);
    const clientSecret = this.readClientSecret(credentials?.clientSecret);
    if (!clientSecret) {
      throw new SireConfigurationError(
        'La integración API SIRE no está configurada.',
      );
    }

    return {
      oauthBaseUrl: this.readSunatUrl('SIRE_AUTH_HOST', SUNAT_AUTH_HOST),
      apiBaseUrl: this.readSunatUrl('SIRE_API_HOST', SUNAT_API_HOST),
      clientId,
      clientSecret,
      timeoutMs: this.readTimeoutMs(),
    };
  }

  private assertIntegrationEnabled(): void {
    const enabled = this.configService.get<
      SireReadOnlyClientConfig['SUNAT_SIRE_INTEGRATION_ENABLED']
    >('SUNAT_SIRE_INTEGRATION_ENABLED');

    if (enabled !== true && enabled !== 'true') {
      throw new SireConfigurationError(
        'La consulta SIRE de solo lectura está desactivada.',
      );
    }
  }

  /**
   * Identificador de aplicación de SUNAT.
   *
   * Un valor de ejemplo se rechaza antes de llamar a SUNAT: fallar aquí es
   * más claro que recibir un 401 desde el exterior.
   *
   * El Client ID propio de la empresa tiene prioridad sobre el del entorno:
   * cada contribuyente se autentica con el suyo.
   */
  private readClientId(preferred?: string): string {
    const own = preferred?.trim();
    const clientId = own
      ? own
      : this.configService.get<string>('SUNAT_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new SireConfigurationError(
        'La integración API SIRE no está configurada.',
      );
    }
    if (PLACEHOLDER_CLIENT_ID_PATTERN.test(clientId)) {
      throw new SireConfigurationError(
        'SUNAT_CLIENT_ID conserva un valor de ejemplo; configura el Client ID real en el entorno.',
      );
    }
    return clientId;
  }

  /**
   * Client Secret de la aplicación de SUNAT.
   *
   * El secreto propio de la empresa tiene prioridad sobre el del entorno.
   */
  private readClientSecret(preferred?: string): string | undefined {
    const own = preferred?.trim();
    if (own) {
      return own;
    }
    return this.configService.get<string>('SUNAT_CLIENT_SECRET');
  }

  private readTimeoutMs(): number {
    const configured = this.configService.get<string>(
      'SUNAT_SIRE_READONLY_TIMEOUT_MS',
    );
    const timeout = Number(configured ?? DEFAULT_TIMEOUT_MS);

    if (
      !Number.isInteger(timeout) ||
      timeout < MIN_TIMEOUT_MS ||
      timeout > MAX_TIMEOUT_MS
    ) {
      throw new SireConfigurationError(
        'La configuración del timeout SIRE no es válida.',
      );
    }
    return timeout;
  }

  /** Lee una URL del entorno y comprueba que es el host oficial de SUNAT. */
  private readSunatUrl(variableName: string, expectedHost: string): string {
    const value = this.configService.get<string>(variableName);
    if (!value) {
      throw new SireConfigurationError(
        'La integración API SIRE no está configurada.',
      );
    }
    return this.validateSunatHost(value, expectedHost).origin;
  }

  /**
   * Solo se admite el host oficial de SUNAT: HTTPS, sin puerto, sin
   * credenciales, sin ruta y sin parámetros.
   */
  private validateSunatHost(value: string, expectedHost: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new SireConfigurationError('La URL SIRE no es válida.');
    }

    const isOfficialHost =
      url.protocol === 'https:' &&
      url.port === '' &&
      url.hostname.toLowerCase() === expectedHost;
    const hasCredentials = Boolean(url.username || url.password);
    const hasExtraParts =
      Boolean(url.search || url.hash) ||
      (url.pathname !== '/' && url.pathname !== '');

    if (!isOfficialHost || hasCredentials || hasExtraParts) {
      throw new SireConfigurationError(
        `La URL SIRE debe usar el host HTTPS oficial ${expectedHost}.`,
      );
    }
    return url;
  }

  private async requestAccessToken(
    config: ValidatedSireConfig,
    username: string,
    solPassword: string,
  ): Promise<string> {
    const tokenUrl = new URL(
      `/v1/clientessol/${encodeURIComponent(config.clientId)}/oauth2/token/`,
      config.oauthBaseUrl,
    );
    const body = new URLSearchParams({
      grant_type: 'password',
      scope: `https://${SUNAT_API_HOST}`,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      username,
      password: solPassword,
    });
    const tokenHeaders = new Headers({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    this.logger.log('Solicitando token de acceso a la API SIRE de SUNAT');

    const requestSecrets = [
      username,
      solPassword,
      config.clientSecret,
      config.clientId,
    ];
    const response = await this.fetchSafely(
      tokenUrl,
      {
        method: 'POST',
        headers: tokenHeaders,
        body,
        redirect: 'error',
      },
      config.timeoutMs,
      requestSecrets,
    );

    if (response.status === 400) {
      const errorDescription = await this.readOauthErrorDescription(
        response,
        requestSecrets,
      );
      this.logger.error(
        `SUNAT rechazó la solicitud de token con HTTP 400. error_description: ${errorDescription}`,
      );
      throw new BadRequestException(
        'SUNAT rechazó la solicitud de autenticación de la integración SIRE.',
      );
    }

    throwForSunatStatus(response, TOKEN_STATUS_MESSAGES);

    const payload = readJson(await this.parseJson(response));
    const token = payload?.['access_token'];
    if (typeof token !== 'string' || token.length === 0) {
      throw new BadGatewayException(
        'SUNAT devolvió una respuesta de autenticación inválida.',
      );
    }
    return token;
  }

  private async readOauthErrorDescription(
    response: Response,
    secrets: readonly string[],
  ): Promise<string> {
    try {
      const payload = readJson(await response.json());
      const description = payload?.['error_description'];
      if (typeof description !== 'string' || description.length === 0) {
        return 'SUNAT no incluyó una descripción del error.';
      }

      return redactSensitiveText(description, secrets).slice(0, 500);
    } catch {
      return 'SUNAT devolvió un cuerpo de error no válido.';
    }
  }

  private requestPeriods(
    config: ValidatedSireConfig,
    bookCode: SirePeriodBookCode,
    accessToken: string,
  ): Promise<Response> {
    const url = new URL(PERIOD_PATHS[bookCode], config.apiBaseUrl);
    return this.fetchSafely(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        redirect: 'error',
      },
      config.timeoutMs,
      [accessToken, config.clientSecret, config.clientId],
    );
  }

  private async fetchSafely(
    url: URL,
    init: RequestInit,
    timeoutMs: number,
    secrets: readonly string[],
  ): Promise<Response> {
    try {
      return await this.fetcher(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new SireTransportError(getFetchErrorDiagnostic(error, secrets));
    }
  }

  private async parseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new BadGatewayException(
        'SUNAT devolvió una respuesta JSON inválida.',
      );
    }
  }
}
