/**
 * Utilidades de simulación del módulo M1: descripción oficial del CDR, hash
 * SHA-256 determinista y cronograma de cuotas al crédito.
 *
 * Se aísla aquí para mantener `invoiceDemoTypes.ts` por debajo del límite de
 * líneas y con una única responsabilidad (tipos + fábrica).
 */
import { round2 } from '../lib/invoiceCalculations';
import type { CuotaDemo } from './invoiceDemoTypes';

/** Descripción oficial del CDR según el código devuelto por SUNAT. */
export const descripcionCdr = (codigo?: string): string => {
  if (!codigo || codigo === '0') {
    return 'El comprobante fue aceptado';
  }
  if (codigo === '4272') {
    return 'El comprobante fue aceptado con observaciones';
  }
  if (codigo === '2017') {
    return 'El número de documento de identidad del receptor no es válido';
  }
  if (codigo === '2335') {
    return 'El documento electrónico fue rechazado: error en el formato';
  }
  return 'El comprobante fue rechazado por SUNAT';
};

/**
 * Genera un hash SHA-256 determinista en Base64 a partir del identificador
 * tributario del comprobante. Es una simulación estable para la demo: el mismo
 * comprobante produce siempre el mismo hash.
 */
export const hashSimulado = (clave: string): string => {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < clave.length; i += 1) {
    const code = clave.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code, 0x85ebca6b) >>> 0;
  }
  const base = `${h1.toString(16).padStart(8, '0')}${h2
    .toString(16)
    .padStart(8, '0')}`;
  const repetido = (base + base + base + base).slice(0, 44);
  return `${repetido}=`;
};

/**
 * Construye un cronograma de cuotas que cuadra exactamente el neto: la última
 * cuota absorbe la diferencia de céntimos para evitar el error SUNAT 3267.
 */
export const construirCuotas = (
  neto: number,
  cantidad: number,
  fechaEmision: string,
  diasEntreCuotas = 30,
): readonly CuotaDemo[] => {
  if (neto <= 0 || cantidad <= 0) return [];

  const montoBase = round2(neto / cantidad);
  const fecha = new Date(`${fechaEmision}T00:00:00Z`);

  return Array.from({ length: cantidad }, (_, i) => {
    const esUltima = i === cantidad - 1;
    const monto = esUltima
      ? round2(neto - montoBase * (cantidad - 1))
      : montoBase;
    const vencimiento = new Date(fecha);
    vencimiento.setUTCDate(
      vencimiento.getUTCDate() + diasEntreCuotas * (i + 1),
    );
    return {
      numero: `Cuota${String(i + 1).padStart(3, '0')}`,
      monto,
      vencimiento: vencimiento.toISOString().slice(0, 10),
    };
  });
};
