/**
 * Consultas derivadas sobre los catálogos de SUNAT (M1).
 *
 * Se separan de `sunatCatalogs` para que ese archivo contenga únicamente las
 * tablas oficiales y respete el límite de líneas del proyecto. Este módulo se
 * limita a interpretar esos datos.
 */
import {
  CATALOGO_01_TIPO_COMPROBANTE,
  CATALOGO_54_DETRACCION,
  TIPOS_RESUMEN,
  TIPOS_UBL,
  UMBRAL_DETRACCION_SOLES,
} from './sunatCatalogs';

/** Devuelve la descripción de un código del Catálogo 01. */
export const descripcionTipoComprobante = (tipo: string): string =>
  (CATALOGO_01_TIPO_COMPROBANTE as Record<string, string>)[tipo] ??
  'Desconocido';

/** Indica si el tipo se emite como documento UBL individual. */
export const esTipoUbl = (tipo: string): boolean =>
  (TIPOS_UBL as readonly string[]).includes(tipo);

/** Indica si el tipo corresponde a un resumen o comunicación de baja. */
export const esTipoResumen = (tipo: string): boolean =>
  (TIPOS_RESUMEN as readonly string[]).includes(tipo);

/** Recupera el porcentaje de detracción de un código del Catálogo 54. */
export const porcentajeDetraccion = (codigo: string): number | null => {
  const entrada = (
    CATALOGO_54_DETRACCION as Record<string, { porcentaje: number }>
  )[codigo];
  return entrada ? entrada.porcentaje : null;
};

/** Indica si una operación supera el umbral de detracción (S/ 700). */
export const superaUmbralDetraccion = (importe: number): boolean =>
  importe > UMBRAL_DETRACCION_SOLES;

/** Indica si un código de afectación corresponde a operación gravada. */
export const esAfectacionGravada = (codigo: string): boolean =>
  codigo.startsWith('1');

/** Indica si un código de afectación está exonerado del IGV. */
export const esAfectacionExonerada = (codigo: string): boolean =>
  codigo.startsWith('2');

/** Indica si un código de afectación es inafecto. */
export const esAfectacionInafecta = (codigo: string): boolean =>
  codigo.startsWith('3');

/** Indica si la operación es una exportación (tasa 0%). */
export const esExportacion = (codigo: string): boolean => codigo === '40';
