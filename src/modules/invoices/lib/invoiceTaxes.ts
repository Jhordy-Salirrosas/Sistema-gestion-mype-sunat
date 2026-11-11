import Decimal from 'decimal.js';
/**
 * Cálculos de IGV, multi-afectación (Catálogo 07) e ICBPER.
 *
 * Forma parte del motor tributario del módulo M1 (Facturación Electrónica UBL
 * 2.1) y se reexporta desde `./invoiceCalculations`. TypeScript puro: no
 * importa React ni dependencias de red.
 */

/** Tasa del IGV vigente en el Perú. */
export const IGV_RATE = 0.18;

/** Tarifa vigente del ICBPER por bolsa plástica, en Soles. */
export const ICBPER_POR_UNIDAD = 0.5;

/** Misma política que money.ts del back: decimal exacto y HALF_UP. */
export const round2 = (num: number): number => new Decimal(num).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
export const multiplyMoney = (a: number, b: number): number => new Decimal(a).times(b).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
export const divideMoney = (a: number, b: number): number => new Decimal(a).div(b).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

/** Tipo de afectación del IGV según el Catálogo 07 de SUNAT. */
export type AfectacionIgv = 'GRAVADA' | 'EXONERADA' | 'INAFECTA' | 'GRATUITA';

/** Línea (o ítem) de un comprobante, con sus datos de venta. */
export interface LineaComprobante {
  /** Valor de venta de la línea, sin IGV. */
  base: number;
  /** Afectación del IGV (Catálogo 07). */
  afectacion: AfectacionIgv;
}

/** Montos mínimos ya redondeados de una línea. */
export interface MontosLinea {
  base: number;
  igv: number;
  total: number;
}

/** Calcula base, IGV y total de una línea según su afectación. */
export const calcularLinea = (linea: LineaComprobante): MontosLinea => {
  const base = round2(linea.base);
  const igv = linea.afectacion === 'GRAVADA' ? multiplyMoney(base, IGV_RATE) : 0;

  return { base, igv, total: round2(base + igv) };
};

/** Suma las bases de las líneas que corresponden a una afectación. */
export const sumarPorAfectacion = (
  lineas: readonly LineaComprobante[],
  afectacion: AfectacionIgv,
): number => {
  return round2(
    lineas
      .filter((linea) => linea.afectacion === afectacion)
      .reduce((acumulado, linea) => acumulado + linea.base, 0),
  );
};

/** Calcula el IGV (18%) a partir de una base imponible. */
export const igvDesdeBase = (base: number): number => {
  return multiplyMoney(base, IGV_RATE);
};

/** Calcula el precio de venta (con IGV) a partir de la base imponible. */
export const totalDesdeBase = (base: number): number => {
  return round2(base + igvDesdeBase(base));
};

/** Deriva la base imponible a partir de un importe total que ya incluye IGV. */
export const baseDesdeTotal = (total: number): number => {
  return divideMoney(total, 1.18);
};

/** Calcula el ICBPER de un número de bolsas plásticas. */
export const calcularIcbper = (bolsas: number): number => {
  if (!Number.isFinite(bolsas) || bolsas <= 0) return 0;
  return multiplyMoney(Math.floor(bolsas), ICBPER_POR_UNIDAD);
};
