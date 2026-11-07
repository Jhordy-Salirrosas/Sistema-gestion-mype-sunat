/**
 * Conversión de importes a letras en español (Catálogo 52, código 1000).
 *
 * Se aísla de `invoiceCreditAndRules.ts` para mantener ambos archivos por
 * debajo del límite de líneas y con una única responsabilidad.
 */
import { round2 } from './invoiceTaxes';

/** Unidades en letras del 0 al 19. */
const UNIDADES = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO',
  'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS',
  'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
];

/** Decenas en letras. */
const DECENAS = [
  '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA',
  'SETENTA', 'OCHENTA', 'NOVENTA',
];

/** Centenas en letras. */
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

/** Convierte un entero menor a 1000 a letras. */
const centenasALetras = (n: number): string => {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else if (resto < 30) {
      partes.push(`VEINTI${UNIDADES[resto - 20].toLowerCase()}`);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`);
    }
  }

  return partes.join(' ');
};

/** Convierte un entero a letras en español (hasta millones). */
const enteroALetras = (n: number): string => {
  if (n === 0) return 'CERO';
  if (n < 1000) return centenasALetras(n);

  const millones = Math.floor(n / 1_000_000);
  const restoMillon = n % 1_000_000;
  const partes: string[] = [];

  if (millones > 0) {
    partes.push(
      millones === 1 ? 'UN MILLÓN' : `${enteroALetras(millones)} MILLONES`,
    );
  }
  if (restoMillon > 0) {
    const miles = Math.floor(restoMillon / 1000);
    const unidades = restoMillon % 1000;
    if (miles > 0) {
      partes.push(miles === 1 ? 'UN MIL' : `${centenasALetras(miles)} MIL`);
    }
    if (unidades > 0) partes.push(centenasALetras(unidades));
  }

  return partes.join(' ');
};

/**
 * Genera la glosa del Catálogo 52 código 1000 (importe en letras).
 *
 * Ej.: 'SON: UN MIL CIENTO OCHENTA Y 00/100 SOLES'.
 */
export const montoEnLetrasSunat = (
  monto: number,
  moneda: 'PEN' | 'USD' = 'PEN',
): string => {
  const redondeado = round2(Math.abs(monto));
  const entero = Math.floor(redondeado);
  const centimos = Math.round((redondeado - entero) * 100);
  const divisa = moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';

  return `SON: ${enteroALetras(entero)} Y ${String(centimos).padStart(
    2,
    '0',
  )}/100 ${divisa}`;
};
