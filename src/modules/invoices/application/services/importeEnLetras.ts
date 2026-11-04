/**
 * Importe en letras para la Leyenda 2006 (M1).
 *
 * SUNAT exige la leyenda 2006 ("SON ... CON 00/100 SOLES") cuando el
 * comprobante lleva detracción, y lo rechaza con la observación 4265 si falta:
 *
 *   "4265 - El XML no contiene el codigo de leyenda 2006 para tipo de operación
 *    de detracciones"
 *
 * El generador UBL ya sabía emitir el bloque, pero solo si el payload traía
 * `montoEnLetras`, y NADIE lo calculaba: la emisión desde pantalla nunca lo
 * enviaba, así que todas las facturas con detracción salían con la observación.
 * Se descubrió leyendo el CDR descargado el 31-10.
 *
 * Se implementa aquí, en un módulo puro, para poder probarlo con los importes
 * feos (cero, céntimos sueltos, miles) sin montar Nest ni generar un XML.
 */

/** Unidades del 0 al 19; el 1 se ajusta a femenino en "una". */
const UNIDADES = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO',
  'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS',
  'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
] as const;

/** Decenas hasta el 90 (antes de las veintenas). */
const DECENAS = [
  '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA',
  'OCHENTA', 'NOVENTA',
] as const;

/** Centenas. El 100 es "CIEN" exacto; 101 en adelante es "CIENTO ...". */
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
] as const;

/** Convierte un número de 1 a 999 a letras. */
const hasta999 = (n: number): string => {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  if (n < 20) return UNIDADES[n];

  if (n < 30) {
    return n === 20 ? 'VEINTE' : `VEINTI${UNIDADES[n - 20]!.toLowerCase().toUpperCase()}`;
  }

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (centena > 0) partes.push(CENTENAS[centena]!);

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]!);
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      if (decena === 2) {
        // Las veintenas se escriben juntas: VEINTIUNO, VEINTIDOS...
        partes.push(unidad === 0 ? 'VEINTE' : `VEINTI${UNIDADES[unidad]}`);
      } else {
        partes.push(
          unidad === 0
            ? DECENAS[decena]!
            : `${DECENAS[decena]} Y ${UNIDADES[unidad]}`,
        );
      }
    }
  }

  return partes.join(' ');
};

/**
 * Convierte un importe a letras con la forma que SUNAT espera.
 *
 * Ejemplo: `1180` → "MIL CIENTO OCHENTA CON 00/100 SOLES".
 *
 * Se redondea a céntimos antes de partir: un importe como 99.999 daría céntimos
 * de 100 sin redondear, y "CON 100/100" no existe.
 */
export const importeEnLetras = (importe: number): string => {
  const seguro = Number.isFinite(importe) ? Math.max(0, importe) : 0;
  const redondeado = Math.round(seguro * 100) / 100;

  const enteros = Math.floor(redondeado);
  const centimos = Math.round((redondeado - enteros) * 100);

  const letras = enLetras(enteros);
  const sufijo = centimos === 0 ? 'CON 00/100 SOLES' : `CON ${centimos}/100 SOLES`;
  return `${letras} ${sufijo}`;
};

/** Parte entera a letras, con escala de millón. */
const enLetras = (n: number): string => {
  if (n === 0) return 'CERO';

  if (n < 1000) return hasta999(n);

  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const prefijo = miles === 1 ? 'MIL' : `${hasta999(miles)} MIL`;
    return resto === 0 ? prefijo : `${prefijo} ${hasta999(resto)}`;
  }

  const millones = Math.floor(n / 1000000);
  const resto = n % 1000000;
  const prefijo =
    millones === 1 ? 'UN MILLON' : `${hasta999(millones)} MILLONES`;

  if (resto === 0) return prefijo;

  // "MIL" sin "UN" delante: UN MILLON MIL, no UN MILLON UN MIL.
  return `${prefijo} ${enLetras(resto)}`;
};
