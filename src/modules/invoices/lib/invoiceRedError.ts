/** Lectura conservadora de un resultado no confirmado; no prueba recepción ni ausencia. */
import type { ComprobanteDemo } from '../data/invoiceDemoSchema';

/**
 * DEUDA A — CERRADA el 3 nov
 *
 * Este módulo nació como apaño: `ERROR_RED` se colapsaba en `FALLO_CRITICO` y
 * cada pantalla tenía que consultar el estado crudo para no llamarlo rechazo.
 * Ahora `MAPA_ESTADOS` lo manda a `SIN_CONFIRMAR`, un valor propio de
 * `CdrStatus` y de `EstadoCdrDemo`, así que el estado se basta a sí mismo.
 *
 * Lo que queda aquí es el RESPALDO para filas antiguas o flujos de demostración
 * que todavía traigan el estado colapsado. El criterio de verdad ya no es esta
 * función: es `estado === 'SIN_CONFIRMAR'`.
 */
export const esErrorDeRed = (c: ComprobanteDemo): boolean =>
  // Criterio principal, el que usan todas las pantallas nuevas.
  c.estado === 'SIN_CONFIRMAR' ||
  c.estadoBackend === 'ERROR_RED' ||
  // Respaldo por si la fila llega sin el estado crudo del backend: la
  // descripción solo habla de "no llegó a SUNAT" cuando la escribió el
  // backend para un fallo de transmisión.
  (!c.cdrCodigo &&
    !c.ultimoErrorCodigo &&
    (c.cdrDescripcion?.includes('No llegó a SUNAT') ?? false));

/** Rótulo del estado fiscal de un comprobante, con su lectura en claro. */
export { LECTURA_INCERTIDUMBRE as LECTURA_ERROR_RED } from './invoiceResultPresentation';
