import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Inject,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SirePeriodBookCode = '140000' | '080000';

export interface SireReadOnlyClientConfig {
  SIRE_AUTH_HOST?: string;
  SIRE_API_HOST?: string;
  SUNAT_CLIENT_ID?: string;
  SUNAT_CLIENT_SECRET?: string;
  SUNAT_SIRE_INTEGRATION_ENABLED?: string | boolean;
  SUNAT_SIRE_READONLY_TIMEOUT_MS?: string;
}

interface ValidatedSireConfig {
  oauthBaseUrl: string;
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
}

export class RetryableSireSunatError extends ServiceUnavailableException {
  constructor(readonly sunatStatus: 500 | 502) {
    super(
      `SUNAT respondió con HTTP ${sunatStatus}; la consulta es reintentable.`,
    );
    this.name = 'RetryableSireSunatError';
  }
}

export class SireTransportError extends ServiceUnavailableException {
  constructor(readonly diagnostic: string) {
    super('No se pudo establecer una conexión segura con SUNAT.');
    this.name = 'SireTransportError';
  }
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

function readJson(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function getFetchErrorDiagnostic(
  error: unknown,
  secrets: readonly string[],
): string {
  const details: string[] = [];
  let current = error;
  for (let depth = 0; depth < 2 && current !== undefined; depth += 1) {
    const record = readJson(current);
    if (!record) break;

    const name =
      typeof record['name'] === 'string' ? record['name'] : 'FetchError';
    const message =
      typeof record['message'] === 'string' ? record['message'] : '';
    const code = typeof record['code'] === 'string' ? record['code'] : '';
    const safeText = [name, code, message]
      .filter(Boolean)
      .join(': ')
      .slice(0, 500);
    details.push(
      secrets.reduce(
        (result, secret) =>
          secret ? result.split(secret).join('[REDACTED]') : result,
        safeText,
      )
        .replace(/bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
        .replace(
          /\b(password|client_secret|access_token|authorization)\s*[:=]\s*([^\s,;&]+)/gi,
          '$1=[REDACTED]',
        ),
    );
    current = record['cause'];
  }

  return details.join(' <- ') || 'Error de transporte sin detalles';
}

function redactSecrets(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string') {
    return secrets.reduce(
      (result, secret) =>
        secret ? result.split(secret).join('[REDACTED]') : result,
      value,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, secrets));
  }
  const record = readJson(value);
  if (!record) return value;

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      /password|secret|token/i.test(key)
        ? '[REDACTED]'
        : redactSecrets(item, secrets),
    ]),
  );
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
  ): Promise<unknown> {
    const config = this.getValidatedConfig();
    const normalizedRuc = ruc.trim();
    const normalizedSolUser = solUser.trim();
    if (!normalizedRuc || !normalizedSolUser) {
      throw new BadRequestException(
        'El RUC y el usuario SOL son obligatorios para la consulta.',
      );
    }

    const username = `${normalizedRuc}${normalizedSolUser}`;
    this.logger.log(
      `Username enviado a SUNAT: [REDACTED] (RUC chars=${normalizedRuc.length}, usuario SOL chars=${normalizedSolUser.length}, total chars=${username.length}, espacios exteriores eliminados=${normalizedRuc !== ruc || normalizedSolUser !== solUser})`,
    );
    const secrets = [
      username,
      `${ruc}${solUser}`,
      solPassword,
      solUser,
      config.clientSecret,
      config.clientId,
    ];
    let accessToken = await this.requestAccessToken(
      config,
      username,
      solPassword,
    );
    secrets.push(accessToken);
    let response = await this.requestPeriods(config, bookCode, accessToken);

    if (response.status === 401) {
      accessToken = await this.requestAccessToken(
        config,
        username,
        solPassword,
      );
      secrets.push(accessToken);
      response = await this.requestPeriods(config, bookCode, accessToken);
    }

    if (response.status === 401) {
      throw new UnauthorizedException(
        'SUNAT rechazó la autenticación SOL para esta consulta.',
      );
    }
    if (response.status === 422) {
      const body = readJson(await this.parseJson(response));
      const errors = Array.isArray(body?.['errors']) ? body['errors'] : [];
      throw new UnprocessableEntityException({
        message: 'SUNAT reportó errores de validación para la consulta.',
        errorCount: errors.length,
      });
    }
    if (response.status === 500 || response.status === 502) {
      throw new RetryableSireSunatError(response.status);
    }
    if (response.status >= 500) {
      throw new ServiceUnavailableException(
        'SUNAT no pudo completar la consulta de períodos.',
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `SUNAT respondió con un estado HTTP no esperado (${response.status}).`,
      );
    }

    return redactSecrets(await this.parseJson(response), secrets);
  }

  assertConfigured(): void {
    this.getValidatedConfig();
  }

  private getValidatedConfig(): ValidatedSireConfig {
    const enabled = this.configService.get<
      SireReadOnlyClientConfig['SUNAT_SIRE_INTEGRATION_ENABLED']
    >('SUNAT_SIRE_INTEGRATION_ENABLED');

    if (enabled !== true && enabled !== 'true') {
      throw new ServiceUnavailableException(
        'La consulta SIRE de solo lectura está desactivada.',
      );
    }

    const oauthBaseUrl = this.configService.get<string>('SIRE_AUTH_HOST');
    const apiBaseUrl = this.configService.get<string>('SIRE_API_HOST');
    const clientId = this.configService.get<string>('SUNAT_CLIENT_ID')?.trim();
    const clientSecret = this.configService.get<string>('SUNAT_CLIENT_SECRET');
    const timeoutMs = this.configService.get<string>(
      'SUNAT_SIRE_READONLY_TIMEOUT_MS',
    );
    if (!oauthBaseUrl || !apiBaseUrl || !clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'La integración API SIRE no está configurada.',
      );
    }
    if (
      /^(tu-|your-|placeholder|inyectar-)|^<.*>$|sin-espacios$/i.test(clientId)
    ) {
      throw new ServiceUnavailableException(
        'SUNAT_CLIENT_ID conserva un valor de ejemplo; configura el Client ID real en el entorno.',
      );
    }

    const oauthUrl = this.validateSunatHost(
      oauthBaseUrl,
      'api-seguridad.sunat.gob.pe',
    );
    const apiUrl = this.validateSunatHost(apiBaseUrl, 'api-sire.sunat.gob.pe');
    const timeout = Number(timeoutMs ?? 10000);
    if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) {
      throw new ServiceUnavailableException(
        'La configuración del timeout SIRE no es válida.',
      );
    }

    return {
      oauthBaseUrl: oauthUrl.origin,
      apiBaseUrl: apiUrl.origin,
      clientId,
      clientSecret,
      timeoutMs: timeout,
    };
  }

  private validateSunatHost(value: string, expectedHost: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new ServiceUnavailableException('La URL SIRE no es válida.');
    }

    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.port !== '' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '') ||
      host !== expectedHost
    ) {
      throw new ServiceUnavailableException(
        `La URL SIRE debe usar el host HTTPS oficial ${expectedHost}.`,
      );
    }
    return url;
  }

  private async requestAccessToken(
    config: ReturnType<SireReadOnlyPeriodsClient['getValidatedConfig']>,
    username: string,
    solPassword: string,
  ): Promise<string> {
    const tokenUrl = new URL(
      `/v1/clientessol/${encodeURIComponent(config.clientId)}/oauth2/token/`,
      config.oauthBaseUrl,
    );
    const body = new URLSearchParams({
      grant_type: 'password',
      scope: 'https://api-sire.sunat.gob.pe',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      username,
      password: solPassword,
    });
    const tokenHeaders = new Headers({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    this.logger.log(
      `Solicitud de token SIRE: POST ${tokenUrl.toString()} | Content-Type: ${tokenHeaders.get('content-type')} | Body keys: ${Array.from(body.keys()).join(', ')}`,
    );

    const response = await this.fetchSafely(
      tokenUrl,
      {
        method: 'POST',
        headers: tokenHeaders,
        body,
        redirect: 'error',
      },
      config.timeoutMs,
      [username, solPassword, config.clientSecret, config.clientId],
    );
    if (response.status === 400) {
      const errorDescription = await this.readOauthErrorDescription(
        response,
        [username, solPassword, config.clientSecret, config.clientId],
      );
      this.logger.error(
        `SUNAT rechazó la solicitud de token con HTTP 400. error_description: ${errorDescription}`,
      );
      throw new BadGatewayException(
        'SUNAT rechazó la solicitud de autenticación de la integración SIRE.',
      );
    }
    if (response.status === 401) {
      throw new UnauthorizedException(
        'SUNAT rechazó la autenticación SOL para esta consulta.',
      );
    }
    if (response.status === 422) {
      throw new UnprocessableEntityException(
        'SUNAT reportó errores de validación al autenticar la consulta.',
      );
    }
    if (response.status === 500 || response.status === 502) {
      throw new RetryableSireSunatError(response.status);
    }
    if (response.status >= 500) {
      throw new ServiceUnavailableException(
        'SUNAT no pudo completar la autenticación.',
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `SUNAT respondió con un estado HTTP no esperado (${response.status}).`,
      );
    }

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

      const sanitized = redactSecrets(description, secrets);
      return typeof sanitized === 'string'
        ? sanitized.slice(0, 500)
        : 'Descripción de error no disponible.';
    } catch {
      return 'SUNAT devolvió un cuerpo de error no válido.';
    }
  }

  private requestPeriods(
    config: ReturnType<SireReadOnlyPeriodsClient['getValidatedConfig']>,
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
      const authorization = new Headers(init.headers).get('authorization');
      const safeAuthorization = authorization?.match(/^Bearer\s+\S+$/i)
        ? 'Bearer [REDACTED]'
        : authorization
          ? '[PRESENT, REDACTED]'
          : '[NOT SET]';
      this.logger.log(
        `Solicitud SIRE: ${init.method ?? 'GET'} ${url.toString()} | Authorization: ${safeAuthorization}`,
      );
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
