/**
 * Consultas derivadas sobre los catálogos de SUNAT (M1).
 *
 * Se separan de `sunatCatalogs` para que ese archivo contenga únicamente las
 * tablas oficiales y respete el límite de líneas del proyecto. Este módulo se
 * limita a interpretar esos datos.
 */
import {
  AFECTACIONES_EXONERADAS,
  AFECTACIONES_GRAVADAS,
  AFECTACIONES_GRATUITAS,
  AFECTACIONES_INAFECTAS,
  AFECTACION_EXPORTACION,
  CATALOGO_01_TIPO_COMPROBANTE,
  CODIGOS_DETRACCION_DADOS_DE_BAJA,
  CATALOGO_54_DETRACCION,
  TIPOS_RESUMEN,
  TIPOS_UBL,
  UMBRAL_DETRACCION_SOLES,
  UNIDADES_FERRETERIA,
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

/**
 * ¿El código del Catálogo 54 sigue vigente? (TA-63)
 *
 * Los códigos dados de baja (006, 018, 029, 033) se reconocen como inválidos
 * aunque algún catálogo antiguo todavía los liste: emitir con ellos produce un
 * rechazo de SUNAT que llega recién después del envío.
 */
export const esCodigoDetraccionVigente = (codigo: string): boolean =>
  !CODIGOS_DETRACCION_DADOS_DE_BAJA.includes(codigo.trim().padStart(3, '0'));

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
export const esExportacion = (codigo: string): boolean =>
  codigo === AFECTACION_EXPORTACION;

/**
 * ¿La línea se declara como transferencia gratuita? (TA-62, regla XSL 3278)
 *
 * Las gratuitas NO suman al `LineExtensionAmount`: se declaran con importe y
 * precio en cero y `PriceTypeCode = '02'`. Tratarlas como una venta normal
 * duplica la base imponible, porque el mismo bien ya se retiró sin cobrar.
 */
export const esAfectacionGratuita = (codigo: string): boolean =>
  AFECTACIONES_GRATUITAS.includes(codigo.trim());

/**
 * Tipo de tributo del Catálogo 05 que corresponde a una afectación.
 *
 * La distinción no es cosmética: SUNAT valida que el `TaxScheme/ID` de la
 * línea coincida con la afectación declarada. Un producto exonerado que
 * declare `1000` (IGV) es un error 2xxx aunque el monto sea cero.
 *
 * @returns `'1000'` IGV, `'9997'` exonerado, `'9998'` inafecto, `'9995'`
 *   exportación, o `null` si el código no pertenece al Catálogo 07.
 */
export const tributoDeAfectacion = (codigo: string): string | null => {
  const limpio = codigo.trim();
  if (AFECTACIONES_GRAVADAS.includes(limpio)) return '1000';
  if (AFECTACIONES_EXONERADAS.includes(limpio)) return '9997';
  if (AFECTACIONES_INAFECTAS.includes(limpio)) return '9998';
  if (limpio === AFECTACION_EXPORTACION) return '9995';
  return null;
};

/** ¿Es una unidad del Catálogo 03 aceptada en una ferretería? */
export const esUnidadFerreteria = (unidad: string): boolean =>
  UNIDADES_FERRETERIA.includes(unidad.trim().toUpperCase());
