/**
 * ¿El comprobante falló en el envío, sin llegar nunca a SUNAT?
 *
 * POR QUÉ ESTÁ EN `lib` Y NO DENTRO DE UN COMPONENTE
 *
 * Un `ERROR_RED` es un fallo de TRANSMISIÓN: el documento no salió del
 * sistema. Un `RECHAZADO` es un VEREDICTO de SUNAT: llegó y lo tiró. Son
 * estados fiscales opuestos y confundirlos afirma algo falso sobre el
 * comprobante.
 *
 * El problema es que el front no puede verlo en `estado`: `mapEstadoCdr`
 * colapsa `FALLO_CRITICO` dentro de `RECHAZADO` para que la fila salga en rojo,
 * así que a los componentes les llega "RECHAZADO" en los dos casos.
 *
 * La decisión tiene que ser UNA sola. Si el modal, la bitácora y la grilla
 * tienen cada uno su propia heurística, acaban discrepando en el borde y la
 * ficha vuelve a contradecirse consigo misma — que es exactamente el defecto
 * que se arregló el 3 nov.
 */
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
export const LECTURA_ERROR_RED =
  'No llegó a SUNAT: el envío falló por un error de red. SUNAT no lo evaluó, así que no hay rechazo ni aceptación.';
