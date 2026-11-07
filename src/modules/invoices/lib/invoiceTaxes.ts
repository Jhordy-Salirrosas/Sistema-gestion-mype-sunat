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

/**
 * Redondea un monto monetario a 2 decimales.
 *
 * Se suma Number.EPSILON antes de multiplicar para corregir la representación
 * binaria: sin ese ajuste, 1.005 * 100 resulta 100.49999999999999 y el
 * redondeo devolvería 1.00 en lugar de 1.01.
 */
export const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

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
  const igv = linea.afectacion === 'GRAVADA' ? round2(base * IGV_RATE) : 0;

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
  return round2(base * IGV_RATE);
};

/** Calcula el precio de venta (con IGV) a partir de la base imponible. */
export const totalDesdeBase = (base: number): number => {
  return round2(base + igvDesdeBase(base));
};

/** Deriva la base imponible a partir de un importe total que ya incluye IGV. */
export const baseDesdeTotal = (total: number): number => {
  return round2(total / (1 + IGV_RATE));
};

/** Calcula el ICBPER de un número de bolsas plásticas. */
export const calcularIcbper = (bolsas: number): number => {
  if (!Number.isFinite(bolsas) || bolsas <= 0) return 0;
  return round2(Math.floor(bolsas) * ICBPER_POR_UNIDAD);
};
