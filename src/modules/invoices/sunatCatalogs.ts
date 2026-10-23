/**
 * Catálogos oficiales de SUNAT usados por el módulo de Facturación (M1).
 *
 * Cada catálogo replica la tabla publicada por SUNAT en el "Anexo 8 – Códigos
 * de catálogos" de las especificaciones UBL 2.1. Se centralizan aquí para que
 * el generador UBL, el validador XSD y las reglas de CDR compartan una única
 * fuente de verdad.
 *
 * Las consultas derivadas sobre estas tablas se exportan desde
 * `./sunatCatalogsQuery` al final de este archivo.
 */

/** Catálogo 01: tipo de comprobante de pago. */
export const CATALOGO_01_TIPO_COMPROBANTE = {
  '01': 'Factura',
  '03': 'Boleta de venta',
  '07': 'Nota de crédito',
  '08': 'Nota de débito',
  '09': 'Guía de remisión - Remitente',
  '20': 'Comprobante de retención',
  '40': 'Comprobante de percepción',
  RA: 'Comunicación de baja',
  RC: 'Resumen diario de boletas y notas',
} as const;

/** Tipos que se emiten como documento UBL individual (<Invoice> o notas). */
export const TIPOS_UBL = ['01', '03', '07', '08'] as const;

/** Tipos que se envían como resumen o comunicación (no llevan líneas). */
export const TIPOS_RESUMEN = ['RA', 'RC'] as const;

/** Catálogo 05: tipo de tributo. */
export const CATALOGO_05_TRIBUTO = {
  '1000': 'IGV - Impuesto General a las Ventas',
  '1016': 'IVAP - Impuesto a la Venta Arancelaria',
  '2000': 'ISC - Impuesto Selectivo al Consumo',
  '7152': 'ICBPER - Impuesto al consumo de bolsas plásticas',
  '9995': 'Exportación - Bienes o servicios',
  '9996': 'Gratuito - No oneroso',
  '9997': 'Exonerado - No gravado',
  '9998': 'Inafecto - No gravado',
} as const;

/**
 * Códigos de afectación del IGV (Catálogo 07).
 * El primer dígito agrupa la naturaleza tributaria de la operación.
 */
export const CATALOGO_07_AFECTACION = {
  '10': 'Gravado - Operación Onerosa',
  '11': 'Gravado - Retiro por premio',
  '12': 'Gravado - Retiro por donación',
  '13': 'Gravado - Retiro por publicidad',
  '14': 'Gravado - Bonificaciones',
  '15': 'Gravado - Retiro por entrega a trabajadores',
  '20': 'Exonerado - Operación Onerosa',
  '21': 'Exonerado - Transferencia gratuita',
  '30': 'Inafecto - Operación Onerosa',
  '31': 'Inafecto - Retiro por bonificación',
  '40': 'Exportación de bienes o servicios',
} as const;

/** Catálogo 09: motivo de la Nota de Crédito. */
export const CATALOGO_09_NOTA_CREDITO = {
  '01': 'Anulación de la operación',
  '02': 'Anulación por error en el RUC',
  '03': 'Corrección por error en la descripción',
  '04': 'Descuento global',
  '05': 'Descuento por ítem',
  '06': 'Devolución total',
  '07': 'Devolución por ítem',
  '08': 'Bonificación',
  '09': 'Disminución en el valor',
  '10': 'Otros conceptos',
  '11': 'Ajustes de operaciones de exportación',
  '13': 'Ajustes de montos y/o fechas de pago al crédito',
} as const;

/** Catálogo 10: motivo de la Nota de Débito. */
export const CATALOGO_10_NOTA_DEBITO = {
  '01': 'Intereses por mora',
  '02': 'Aumento en el valor',
  '03': 'Penalidades / otros conceptos',
  '11': 'Ajustes de operaciones de exportación',
} as const;

/** Catálogo 51: tipo de operación. */
export const CATALOGO_51_TIPO_OPERACION = {
  '0101': 'Venta interna',
  '0200': 'Exportación de mercancías',
  '0201': 'Exportación de servicios',
  '0401': 'Ventas no domiciliadas',
  '1001': 'Operación sujeta a detracción',
  '2001': 'Operación sujeta a percepción',
} as const;

/** Catálogo 54: código de bien o servicio sujeto a detracción (SPOT). */
export const CATALOGO_54_DETRACCION = {
  '012': { descripcion: 'Demás servicios gravados con el IGV', porcentaje: 0.12 },
  '019': { descripcion: 'Servicio de naturaleza intangible', porcentaje: 0.12 },
  '022': { descripcion: 'Otros servicios empresariales', porcentaje: 0.1 },
  '027': { descripcion: 'Flete terrestre', porcentaje: 0.04 },
  '035': { descripcion: 'Intermediación laboral', porcentaje: 0.12 },
  '039': { descripcion: 'Arrendamiento de bienes muebles', porcentaje: 0.1 },
} as const;

/** Umbral en soles por encima del cual la detracción es obligatoria (SPOT). */
export const UMBRAL_DETRACCION_SOLES = 700;

/** Tasa del IGV vigente. */
export const TASA_IGV = 0.18;

/** Tasa de la retención del IGV aplicada por agente de retención. */
export const TASA_RETENCION_IGV = 0.03;

/** Impuesto a las bolsas plásticas (ICBPER) por bolsa, en soles. */
export const MONTO_ICBPER_POR_BOLSA = 0.5;

export * from './sunatCatalogsQuery';
