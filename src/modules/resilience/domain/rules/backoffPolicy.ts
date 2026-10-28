/**
 * Política de backoff exponencial de la cola de comprobantes (HU-04).
 *
 * Regla de negocio pura: no conoce pg-boss, Prisma ni HTTP. El orquestador
 * (`InvoiceRetryService`) es quien duerme y quien mueve el job a la DLQ.
 *
 * La historia habla de "3 intentos" y de retardos de 5, 15 y 45 s. Un retardo
 * solo tiene sentido si existe un intento posterior, así que la política se
 * implementa como 3 REINTENTOS (4 envíos en total), que es la lectura usada por
 * TA-38 ("se agotan 3 reintentos") y TA-57 ("se reintentan 3 veces").
 *
 * Secuencia:
 *   envío 1 falla -> espera 5 s
 *   envío 2 falla -> espera 15 s
 *   envío 3 falla -> espera 45 s
 *   envío 4 falla -> DLQ + Invoice.ERROR_RED
 */
export const BACKOFF_DELAYS_MS = [5_000, 15_000, 45_000] as const;

/** Cantidad de reintentos posteriores al envío inicial. */
export const MAX_REINTENTOS = BACKOFF_DELAYS_MS.length;

/** Cantidad total de envíos: el inicial más los 3 reintentos. */
export const MAX_INTENTOS = MAX_REINTENTOS + 1;

/** Qué hacer después de un intento de envío. */
export type DecisionReintento = 'REINTENTAR' | 'DLQ' | 'DETENER';

/** Lo mínimo que necesita la política de un resultado de envío. */
export interface ResultadoEnvioReintentable {
  /** true solo para red, timeout, 5xx o CDR ilegible; false para rechazo de negocio. */
  reintentable: boolean;
}

/**
 * Decide el siguiente paso tras un intento.
 *
 * - `DETENER`: el CDR rechazó el comprobante por negocio; reintentar repetiría
 *   el mismo error. No va a la DLQ: queda con el estado que persistió SUNAT.
 * - `REINTENTAR`: fallo transitorio y aún quedan reintentos.
 * - `DLQ`: fallo transitorio y ya se agotaron los reintentos.
 */
export function decidirReintento(
  resultado: ResultadoEnvioReintentable,
  intento: number,
): DecisionReintento {
  if (!resultado.reintentable) return 'DETENER';
  if (intento >= MAX_INTENTOS) return 'DLQ';
  return 'REINTENTAR';
}

/**
 * Retardo, en milisegundos, que sigue al intento fallido `intento` (1-based).
 * Para el último envío devuelve el último retardo configurado; el orquestador
 * no lo usa porque `decidirReintento` ya devolvió `DLQ`.
 */
export function delayDelReintento(intento: number): number {
  if (!Number.isInteger(intento) || intento < 1) {
    throw new RangeError(`Número de intento inválido: ${intento}`);
  }

  const indice = Math.min(intento, MAX_REINTENTOS) - 1;
  return BACKOFF_DELAYS_MS[indice];
}
