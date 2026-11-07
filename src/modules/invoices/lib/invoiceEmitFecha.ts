/**
 * Validación de la fecha de emisión editable (D9).
 *
 * POR QUÉ ES UN MÓDULO APARTE
 *
 * D9 abre dos campos que hasta hoy no existían en el formulario: la fecha de
 * emisión y su comprobación. La validación tiene que verse en el mismo sitio que
 * las demás reglas del borrador (`motivosPendientes`) y tiene que poder probarse
 * sin montar React, así que es una función pura.
 *
 * LAS TRES REGLAS, Y POR QUÉ CADA UNA
 *
 *  1. **La fecha tiene que existir.** `2026-02-30` se teclea sin querer y el
 *     navegador la acepta; el backend la convierte a una fecha distinta.
 *  2. **No se puede fechar en el futuro.** Un comprobante se emite hoy o antes.
 *     Fechar el 20 de noviembre un documento que SUNAT recibe el 3 crearía un
 *     desfase que la contabilidad y el SIRE no pueden explicar.
 *  3. **Hacia atrás, como máximo el plazo del resumen (regla 2957).** Pasado ese
 *     plazo las boletas ya no se pueden informar por resumen diario: el
 *     comprobante nace sin forma de declararse.
 *
 * Las tres usan la fecha de HOY en Lima, no la del equipo: en un servidor en UTC
 * el «hoy» de Lima es el día anterior hasta las 19:00.
 */
import { DIAS_MAXIMOS_ATRASO, diasEntreFechas, fechaIsoValida, hoyEnLima } from './invoiceFecha';

/** ¿La fecha de emisión es aceptable? Devuelve el motivo si no lo es. */
export const problemaDeFechaEmision = (
  fecha: string,
  hoy: string = hoyEnLima(),
): string | null => {
  if (!fecha.trim()) return 'Indique la fecha de emisión.';

  if (!fechaIsoValida(fecha)) {
    return `La fecha ${fecha} no existe en el calendario.`;
  }

  // Se mide de la FECHA EMITIDA a HOY: positivo = en el pasado, negativo =
  // futuro. Al revés (hoy → fecha) el signo se invierte y toda fecha pasada
  // parecería futura.
  const dias = diasEntreFechas(fecha, hoy);
  // `dias` es negativo cuando la fecha es futura.
  if (dias !== null && dias < 0) {
    return `La fecha de emisión no puede ser futura: hoy es ${hoy}.`;
  }

  if (dias !== null && dias > DIAS_MAXIMOS_ATRASO) {
    return (
      `La fecha de emisión quedó ${dias} días atrás y el resumen diario solo ` +
      `admite ${DIAS_MAXIMOS_ATRASO} (regla 2957): el comprobante no se podría informar.`
    );
  }

  return null;
};

/**
 * ¿Se puede fechar en un día posterior a hoy?
 *
 * Se expone aparte porque el `<input type="date">` necesita el tope para no
 * ofrecer días que la validación va a rechazar: pintar el calendario entero y
 * dejar que el usuario elija un día imposible solo sirve para hacerle ver un
 * error después.
 */
export const topeDeFechaEmision = (hoy: string = hoyEnLima()): string => hoy;

/** La fecha más antigua que el formulario permite, en `YYYY-MM-DD`. */
export const minimoDeFechaEmision = (hoy: string = hoyEnLima()): string => {
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - DIAS_MAXIMOS_ATRASO);
  return d.toISOString().slice(0, 10);
};
