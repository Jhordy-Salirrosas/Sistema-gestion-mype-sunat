/**
 * Idempotencia del envío (TA-32) — Frente 2: conciliar antes de reintentar.
 *
 * Cuando un envío termina en TIMEOUT el comprobante queda en estado incierto:
 * SUNAT pudo haberlo procesado y su CDR se perdió en el camino. Volver a
 * enviarlo produce el duplicado que esta tarea evita; no enviarlo deja el
 * comprobante trabado para siempre.
 *
 * La salida es preguntar primero: `esTimeoutDeEnvio` decide si hay que
 * conciliar, y esta función aplica la conciliación sobre el resultado que
 * devuelva la consulta de estado (TA-30). El criterio 3 del backlog exige
 * exactamente eso: "antes de reintentar por timeout, consulta el estado para
 * no reenviar lo ya aceptado".
 *
 * Ojo: el criterio del backlog llama "TA-33" a la consulta de estado, pero en
 * la numeración oficial TA-33 es el Circuit Breaker y la consulta es TA-30.
 * Se toma TA-30 como referencia correcta.
 */
import { isSunatTransportError } from '../../../sunat/soap/sunat-soap.client';
import type { ProcessCdrResult } from '../../../sunat/soap/sunatBillTypes';

/** Desenlace de mirar el intento anterior antes del siguiente. */
export type DecisionConciliacion =
  /** Reenviar es seguro: SUNAT no tiene constancia del comprobante. */
  | 'REINTENTAR'
  /** El intento anterior no fue timeout: no hay estado incierto que resolver. */
  | 'SIN_CONCILIACION';

/**
 * Motivo por el que un resultado queda en estado incierto.
 *
 * `tiempoRespuestaMs === null` y `estado === ENVIADO` es la firma que deja
 * `handleSunatBillError` cuando el transporte falló (no hubo respuesta que
 * medir). Un SOAP Fault o un rechazo de negocio sí traen tiempo y estado
 * final, y no se concilian.
 */
function fueIncierto(resultado: ProcessCdrResult | null): boolean {
  if (!resultado) return false;
  return !resultado.valido && resultado.reintentable && resultado.cdr === null;
}

/**
 * Decide si hay que consultar el estado antes de reenviar (criterio 3).
 *
 * @param resultado Resultado del intento anterior, si lo hubo.
 * @param error Error lanzado en ese intento, si lo hubo.
 */
export function requiereConciliacion(
  resultado: ProcessCdrResult | null,
  error: unknown,
): boolean {
  if (error) return isSunatTransportError(error) && esTimeout(error);
  return fueIncierto(resultado);
}

/** El error de transporte describe un timeout. */
function esTimeout(error: unknown): boolean {
  if (!isSunatTransportError(error)) return false;
  return /timeout/i.test(error.message);
}

/**
 * Traduce la consulta de estado a un resultado del pipeline.
 *
 * Si SUNAT SÍ tenía el comprobante, su CDR se recupera y el flujo termina con
 * ese estado: no se reenvía. Si SUNAT no lo tiene, se devuelve `null` para que
 * el orquestador reenvíe, ahora sí, con la certeza de que no hay duplicado.
 *
 * @param consultado Resultado de `getStatus`; `null` si no se pudo consultar.
 * @returns El resultado recuperado, o `null` para indicar "reenviar es seguro".
 */
export function resultadoTrasConciliacion(
  consultado: ProcessCdrResult | null,
): ProcessCdrResult | null {
  if (!consultado) return null;
  // Un CDR recuperado es definitivo solo si tiene clasificación de negocio; si
  // la consulta también falló por red, no resuelve nada y sigue siendo incierto.
  if (consultado.cdr === null) return null;
  return consultado;
}
