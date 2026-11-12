import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  SIRE_PERIOD_ERROR_CODES,
  sunatHttpErrorCode,
  type SirePeriodErrorCode,
} from '../../domain/rules/sirePeriodFailureMessages';
import {
  RetryableSireSunatError,
  SireConfigurationError,
  SireTransportError,
} from './sunatErrors';

/**
 * Clasificación de un fallo de SUNAT.
 *
 * `errorCode` es lo que queda persistido en `sire_period_queries`; nunca
 * contiene credenciales ni cuerpos crudos de SUNAT. `retryable` indica si el
 * trabajo debe volver a la cola de PgBoss.
 */
export interface SireSunatFailure {
  errorCode: SirePeriodErrorCode;
  retryable: boolean;
}

interface FailureRule {
  matches: (error: unknown) => boolean;
  failure: SireSunatFailure;
}

/**
 * Fallos que NO conviene reintentar.
 *
 * El orden importa: `SireConfigurationError` hereda de
 * `ServiceUnavailableException`, así que debe evaluarse antes que él.
 */
const NON_RETRYABLE_RULES: readonly FailureRule[] = [
  {
    matches: (error) => error instanceof SireConfigurationError,
    failure: {
      errorCode: SIRE_PERIOD_ERROR_CODES.SIRE_NOT_CONFIGURED,
      retryable: false,
    },
  },
  {
    matches: (error) => error instanceof BadRequestException,
    failure: {
      errorCode: SIRE_PERIOD_ERROR_CODES.SUNAT_HTTP_400,
      retryable: false,
    },
  },
  {
    matches: (error) => error instanceof UnauthorizedException,
    failure: {
      errorCode: SIRE_PERIOD_ERROR_CODES.SUNAT_AUTH_FAILED,
      retryable: false,
    },
  },
  {
    matches: (error) => error instanceof UnprocessableEntityException,
    failure: {
      errorCode: SIRE_PERIOD_ERROR_CODES.SUNAT_HTTP_422,
      retryable: false,
    },
  },
  {
    matches: (error) => error instanceof ServiceUnavailableException,
    failure: {
      errorCode: SIRE_PERIOD_ERROR_CODES.SUNAT_UNAVAILABLE,
      retryable: false,
    },
  },
  {
    matches: (error) => error instanceof BadGatewayException,
    failure: {
      errorCode: SIRE_PERIOD_ERROR_CODES.SUNAT_BAD_RESPONSE,
      retryable: false,
    },
  },
];

/** Diagnósticos de red que son un tiempo de espera y no un corte. */
const TIMEOUT_PATTERN = /timeout|timed out|aborted/i;

/**
 * Traduce el fallo de SUNAT al código persistible y decide si el trabajo
 * vuelve a la cola.
 *
 * Los 500/502/503 y los fallos de red son reintentables; el resto se marca
 * como fallido de inmediato porque reintentarlo no mejora el resultado.
 */
export function classifySireSunatFailure(error: unknown): SireSunatFailure {
  if (error instanceof RetryableSireSunatError) {
    return {
      errorCode: sunatHttpErrorCode(error.sunatStatus),
      retryable: true,
    };
  }

  if (error instanceof SireTransportError) {
    return {
      errorCode: TIMEOUT_PATTERN.test(error.diagnostic)
        ? SIRE_PERIOD_ERROR_CODES.SUNAT_TIMEOUT
        : SIRE_PERIOD_ERROR_CODES.SUNAT_TRANSPORT_ERROR,
      retryable: true,
    };
  }

  const rule = NON_RETRYABLE_RULES.find((candidate) =>
    candidate.matches(error),
  );
  return (
    rule?.failure ?? {
      errorCode: SIRE_PERIOD_ERROR_CODES.SUNAT_REQUEST_FAILED,
      retryable: false,
    }
  );
}
