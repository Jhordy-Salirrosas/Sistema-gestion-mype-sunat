/**
 * Catálogo único de códigos de error y mensajes de los trabajos del menú SIRE
 * (importación y reporte).
 *
 * POR QUÉ EXISTE
 *
 * El worker PERSISTE el código (`sire_importaciones.error_code` y
 * `sire_reportes.error_code`) y el endpoint de estado lo TRADUCE al texto que
 * ve el usuario. Sin esta traducción, el frontend tenía que mantener su propio
 * mapa de códigos: un código nuevo se traducía a "undefined" en pantalla.
 *
 * El tipo `SireJobErrorCode` obliga a que todo código del catálogo tenga su
 * mensaje: si se añade un código sin mensaje, TypeScript falla.
 */

/** Códigos que puede persistir el worker del menú SIRE. */
export const SIRE_JOB_ERROR_CODES = {
  QUEUE_ENQUEUE_FAILED: 'QUEUE_ENQUEUE_FAILED',
  SIRE_RETRIES_EXHAUSTED: 'SIRE_RETRIES_EXHAUSTED',
  ARCHIVO_INVALIDO: 'ARCHIVO_INVALIDO',
  ALMACENAMIENTO_ERROR: 'ALMACENAMIENTO_ERROR',
  PROCESAMIENTO_ERROR: 'PROCESAMIENTO_ERROR',
} as const;

export type SireJobErrorCode =
  (typeof SIRE_JOB_ERROR_CODES)[keyof typeof SIRE_JOB_ERROR_CODES];

/** La cola es infraestructura: el frontend debe poder reintentar. */
export const SIRE_JOB_QUEUE_UNAVAILABLE_MESSAGE =
  'No se pudo registrar el trabajo en la cola de procesamiento. Inténtalo de nuevo en unos minutos.';

/** Se agotaron los reintentos del worker. */
export const SIRE_JOB_RETRIES_EXHAUSTED_MESSAGE =
  'El trabajo falló varias veces y pasó a la cola de errores. Revisa el archivo e inténtalo de nuevo.';

/** El archivo no cumple el formato de una propuesta SIRE. */
export const SIRE_JOB_INVALID_FILE_MESSAGE =
  'El archivo no cumple el formato de una propuesta SIRE. Revisa el nombre y el contenido e inténtalo de nuevo.';

/** No se pudo guardar el archivo en el almacenamiento. */
export const SIRE_JOB_STORAGE_ERROR_MESSAGE =
  'No se pudo guardar el archivo del trabajo. Inténtalo de nuevo en unos minutos.';

/** Fallo genérico del procesamiento. */
export const SIRE_JOB_GENERIC_FAILURE_MESSAGE =
  'No se pudo completar el trabajo. Inténtalo de nuevo en unos minutos.';

/**
 * Texto que ve el usuario por cada código persistido.
 *
 * El tipo `Record<SireJobErrorCode, string>` obliga a que todo código del
 * catálogo tenga su mensaje.
 */
export const SIRE_JOB_FAILURE_MESSAGES: Record<SireJobErrorCode, string> = {
  QUEUE_ENQUEUE_FAILED: SIRE_JOB_QUEUE_UNAVAILABLE_MESSAGE,
  SIRE_RETRIES_EXHAUSTED: SIRE_JOB_RETRIES_EXHAUSTED_MESSAGE,
  ARCHIVO_INVALIDO: SIRE_JOB_INVALID_FILE_MESSAGE,
  ALMACENAMIENTO_ERROR: SIRE_JOB_STORAGE_ERROR_MESSAGE,
  PROCESAMIENTO_ERROR: SIRE_JOB_GENERIC_FAILURE_MESSAGE,
};

/**
 * Texto accionable para el frontend a partir del código persistido.
 *
 * Devuelve `null` cuando no hay código: el trabajo no falló y no hay nada que
 * mostrar. Un código desconocido nunca muestra un detalle interno: devuelve el
 * texto genérico.
 */
export function friendlySireJobFailureMessage(
  errorCode: string | null | undefined,
): string | null {
  if (!errorCode) {
    return null;
  }
  const known = SIRE_JOB_FAILURE_MESSAGES[errorCode as SireJobErrorCode];
  return known ?? SIRE_JOB_GENERIC_FAILURE_MESSAGE;
}
