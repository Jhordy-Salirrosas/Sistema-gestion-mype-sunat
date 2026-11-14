/**
 * Catálogo único de códigos de error y mensajes de la consulta de períodos.
 *
 * POR QUÉ EXISTE
 *
 * El worker PERSISTE el código (`sire_period_queries.error_code`) y el
 * controlador lo TRADUCE al texto que ve el usuario. Los dos lived en archivos
 * distintos y el mapa de mensajes se mantenía a mano: un código nuevo sin
 * mensaje devolvía un texto genérico al frontend.
 *
 * Aquí están los dos, juntos y tipados: el tipo `SirePeriodErrorCode` obliga
 * a que todo código tenga su mensaje.
 */

export const SIRE_PERIOD_ERROR_CODES = {
  REQUEST_CONTEXT_INVALID: 'REQUEST_CONTEXT_INVALID',
  CREDENTIALS_UNAVAILABLE: 'CREDENTIALS_UNAVAILABLE',
  QUEUE_ENQUEUE_FAILED: 'QUEUE_ENQUEUE_FAILED',
  SUNAT_HTTP_400: 'SUNAT_HTTP_400',
  SUNAT_HTTP_422: 'SUNAT_HTTP_422',
  SUNAT_HTTP_500: 'SUNAT_HTTP_500',
  SUNAT_HTTP_502: 'SUNAT_HTTP_502',
  SUNAT_HTTP_503: 'SUNAT_HTTP_503',
  SUNAT_AUTH_FAILED: 'SUNAT_AUTH_FAILED',
  SUNAT_UNAVAILABLE: 'SUNAT_UNAVAILABLE',
  SUNAT_TIMEOUT: 'SUNAT_TIMEOUT',
  SUNAT_TRANSPORT_ERROR: 'SUNAT_TRANSPORT_ERROR',
  SUNAT_RETRIES_EXHAUSTED: 'SUNAT_RETRIES_EXHAUSTED',
  SUNAT_BAD_RESPONSE: 'SUNAT_BAD_RESPONSE',
  SUNAT_REQUEST_FAILED: 'SUNAT_REQUEST_FAILED',
  SIRE_NOT_CONFIGURED: 'SIRE_NOT_CONFIGURED',
} as const;

export type SirePeriodErrorCode =
  (typeof SIRE_PERIOD_ERROR_CODES)[keyof typeof SIRE_PERIOD_ERROR_CODES];

/** La cola es infraestructura: el frontend debe poder reintentar. */
export const SIRE_QUEUE_UNAVAILABLE_MESSAGE =
  'El servicio de colas no está disponible, por favor reintenta.';

/** SUNAT no respondió: no es culpa del usuario y conviene reintentar. */
export const SIRE_SUNAT_UNAVAILABLE_MESSAGE =
  'El servicio de SUNAT no está disponible temporalmente. Inténtalo más tarde.';

/** La consulta SIRE no puede ejecutarse porque el entorno no la habilitó. */
export const SIRE_NOT_AVAILABLE_MESSAGE =
  'La consulta de períodos SIRE no está disponible en este entorno. Inténtalo más tarde.';

/** No se pudo registrar la consulta: tampoco hay un `messageId` consultable. */
export const SIRE_REQUEST_STORE_FAILED_MESSAGE =
  'No fue posible registrar la consulta de períodos SIRE. Inténtalo nuevamente.';

/** Texto por defecto cuando el código persistido no se reconoce. */
export const SIRE_GENERIC_FAILURE_MESSAGE =
  'No se pudo completar la consulta de períodos SIRE. Inténtalo más tarde.';

/**
 * Texto que ve el usuario por cada código persistido.
 *
 * El tipo `Record<SirePeriodErrorCode, string>` obliga a que todo código del
 * catálogo tenga su mensaje: si se añade un código, TypeScript falla.
 */
export const SIRE_FAILURE_MESSAGES: Record<SirePeriodErrorCode, string> = {
  REQUEST_CONTEXT_INVALID:
    'La solicitud no corresponde a una empresa activa.',
  CREDENTIALS_UNAVAILABLE:
    'La empresa no tiene credenciales SIRE configuradas. Configúralas antes de consultar los períodos.',
  QUEUE_ENQUEUE_FAILED: SIRE_QUEUE_UNAVAILABLE_MESSAGE,
  SUNAT_HTTP_400:
    'SUNAT rechazó la solicitud. Verifica el usuario SOL, la clave y el libro consultado.',
  SUNAT_HTTP_422: 'SUNAT no pudo validar los datos de la consulta.',
  SUNAT_HTTP_500: SIRE_SUNAT_UNAVAILABLE_MESSAGE,
  SUNAT_HTTP_502: SIRE_SUNAT_UNAVAILABLE_MESSAGE,
  SUNAT_HTTP_503: SIRE_SUNAT_UNAVAILABLE_MESSAGE,
  SUNAT_AUTH_FAILED:
    'SUNAT rechazó las credenciales SOL. Verifica el usuario y la clave.',
  SUNAT_UNAVAILABLE: SIRE_SUNAT_UNAVAILABLE_MESSAGE,
  SUNAT_TIMEOUT: SIRE_SUNAT_UNAVAILABLE_MESSAGE,
  SUNAT_TRANSPORT_ERROR: SIRE_SUNAT_UNAVAILABLE_MESSAGE,
  SUNAT_RETRIES_EXHAUSTED: SIRE_SUNAT_UNAVAILABLE_MESSAGE,
  SUNAT_BAD_RESPONSE:
    'SUNAT devolvió una respuesta inesperada. Inténtalo más tarde.',
  SUNAT_REQUEST_FAILED: SIRE_GENERIC_FAILURE_MESSAGE,
  SIRE_NOT_CONFIGURED:
    'La integración con SUNAT no está configurada en este entorno. Contacta al administrador.',
};

/**
 * Texto accionable para el frontend a partir del código persistido.
 *
 * Un código desconocido nunca muestra un detalle interno: devuelve el texto
 * genérico.
 */
export function friendlySireFailureMessage(
  errorCode: string | null | undefined,
): string {
  if (!errorCode) {
    return SIRE_GENERIC_FAILURE_MESSAGE;
  }
  const known = SIRE_FAILURE_MESSAGES[errorCode as SirePeriodErrorCode];
  return known ?? SIRE_GENERIC_FAILURE_MESSAGE;
}

/**
 * Código persistible para una respuesta HTTP de SUNAT.
 *
 * Los 500/502/503 son reintentables; cualquier otro estado no tiene código
 * propio y se registra como fallo genérico de la solicitud.
 */
export function sunatHttpErrorCode(status: number): SirePeriodErrorCode {
  const code = `SUNAT_HTTP_${status}`;
  const known = SIRE_PERIOD_ERROR_CODES[
    code as keyof typeof SIRE_PERIOD_ERROR_CODES
  ];
  return known ?? SIRE_PERIOD_ERROR_CODES.SUNAT_REQUEST_FAILED;
}
