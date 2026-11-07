/**
 * Contrato del envío de un resumen diario (RC) o de una baja (RA) — D11.
 *
 * Es la respuesta de `POST /invoices/resumenes/{diario,baja}/enviar`, tal como
 * la devuelve `SummaryEnvioService` en el backend.
 *
 * POR QUÉ NO HAY UN CDR AQUÍ
 *
 * Un resumen no se acepta en el momento: SUNAT responde con un TICKET y el CDR
 * llega después, por el worker de resúmenes. Pintar un "ACEPTADO" al encolar
 * sería exactamente el defecto que se corrigió en la emisión individual, donde
 * el sistema inventaba un CDR cuando el envío fallaba.
 */
export interface ResultadoEnvioAgregado {
  /** `true` solo si llegó a ENCOLARSE. No significa aceptado por SUNAT. */
  enviado: boolean;
  /** Identificador del envío: RC-AAAAMMDD-NNN o RA-AAAAMMDD-NNN. */
  identificador: string;
  /** Job de la cola, cuando se llegó a encolar. */
  jobId: string | null;
  /** Líneas que entraron al envío. */
  incluidos: number;
  /**
   * Motivo por el que NO se envió.
   *
   * No es un error del servidor: es una decisión (vista con errores, nada que
   * informar, comprobante fuera del plazo de la regla 2957). Se muestra tal
   * cual, sin reinterpretarlo.
   */
  motivo: string | null;
}
