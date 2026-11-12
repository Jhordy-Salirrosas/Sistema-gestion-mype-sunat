import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Errores de la integración de solo lectura con SUNAT.
 *
 * Viven en su propio archivo porque los usan el cliente HTTP, el worker y el
 * clasificador de fallos. Si vivieran en el cliente, el worker tendría que
 * importar el cliente entero solo para distinguir un 502 reintentable de un
 * 500 que no lo es.
 */

export class RetryableSireSunatError extends ServiceUnavailableException {
  constructor(readonly sunatStatus: 500 | 502 | 503) {
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

/**
 * La integración no está operativa por configuración del entorno (switch
 * apagado, credenciales de aplicación ausentes, URL o timeout inválidos).
 *
 * Es un fallo del despliegue, no de SUNAT: el worker lo distingue para no
 * atribuirle al proveedor un problema que no es suyo.
 */
export class SireConfigurationError extends ServiceUnavailableException {
  constructor(message: string) {
    super(message);
    this.name = 'SireConfigurationError';
  }
}

/** Textos que el cliente necesita para cada respuesta rechazada por SUNAT. */
export interface SunatStatusMessages {
  unauthorized: string;
  unprocessable: string;
  serviceUnavailable: string;
  badRequest?: string;
}

/**
 * Traduce el estado HTTP de SUNAT a la excepción que corresponde.
 *
 * La escalera estaba duplicada en el cliente (autenticación y consulta de
 * períodos): un cambio en un estado tenía que hacerse en dos sitios y era
 * fácil que se desincronizaran. Aquí hay una sola definición.
 *
 * El orden no importa entre estados excluyentes; solo `!response.ok` debe
 * quedar al final porque es el caso genérico.
 */
export function throwForSunatStatus(
  response: Response,
  messages: SunatStatusMessages,
): void {
  const status = response.status;

  if (status === 400 && messages.badRequest) {
    throw new BadRequestException(messages.badRequest);
  }
  if (status === 401) {
    throw new UnauthorizedException(messages.unauthorized);
  }
  if (status === 422) {
    throw new UnprocessableEntityException(messages.unprocessable);
  }
  if (status === 500 || status === 502 || status === 503) {
    throw new RetryableSireSunatError(status);
  }
  if (status >= 500) {
    throw new ServiceUnavailableException(messages.serviceUnavailable);
  }
  if (!response.ok) {
    throw new BadGatewayException(
      `SUNAT respondió con un estado HTTP no esperado (${status}).`,
    );
  }
}
