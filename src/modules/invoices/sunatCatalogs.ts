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
 *
 * Los códigos 11-16, 21 y 31-36 son RETIROS Y TRANSFERENCIAS GRATUITAS: la
 * operación está gravada (o exonerada, o inafecta) pero no se cobra nada. SUNAT
 * exige que se declaren con `PriceAmount = 0`, `PriceTypeCode = '02'` y
 * EXCLUIDAS del `LineExtensionAmount` (regla XSL 3278). Declararlas como una
 * venta normal infla la base imponible del comprobante.
 */
export const CATALOGO_07_AFECTACION = {
  '10': 'Gravado - Operación Onerosa',
  '11': 'Gravado - Retiro por premio',
  '12': 'Gravado - Retiro por donación',
  '13': 'Gravado - Retiro por publicidad',
  '14': 'Gravado - Bonificaciones',
  '15': 'Gravado - Retiro por entrega a trabajadores',
  '16': 'Gravado - Retiro',
  '17': 'Gravado - Retiro por premio (IVAP)',
  '20': 'Exonerado - Operación Onerosa',
  '21': 'Exonerado - Transferencia gratuita',
  '30': 'Inafecto - Operación Onerosa',
  '31': 'Inafecto - Retiro por bonificación',
  '32': 'Inafecto - Retiro',
  '33': 'Inafecto - Retiro por muestras médicas',
  '34': 'Inafecto - Retiro por convenio colectivo',
  '35': 'Inafecto - Retiro por premio',
  '36': 'Inafecto - Retiro por publicidad',
  '37': 'Inafecto - Retiro por entrega a trabajadores',
  '40': 'Exportación de bienes o servicios',
} as const;

/**
 * Afectaciones del Catálogo 07 que se declaran como transferencia GRATUITA.
 *
 * Se listan explícitamente y no por rango ("el primer dígito es 1 y no es 10")
 * porque un rango capturaría códigos onerosos que SUNAT añada en el futuro.
 */
export const AFECTACIONES_GRATUITAS: readonly string[] = [
  '11', '12', '13', '14', '15', '16',
  '21',
  '31', '32', '33', '34', '35', '36', '37',
];

/**
 * Afectaciones cuya operación está gravada con IGV.
 *
 * Incluye las gratuitas gravadas (11-16): el IGV se calcula sobre el valor
 * referencial aunque no se cobre, porque el retiro está gravado por ley.
 */
export const AFECTACIONES_GRAVADAS: readonly string[] = [
  '10', '11', '12', '13', '14', '15', '16', '17',
];

/** Códigos de afectación exonerados del IGV (no llevan tributo 1000). */
export const AFECTACIONES_EXONERADAS: readonly string[] = ['20', '21'];

/** Códigos de afectación inafectos (no llevan tributo 1000). */
export const AFECTACIONES_INAFECTAS: readonly string[] = [
  '30', '31', '32', '33', '34', '35', '36', '37',
];

/** Código de afectación de exportación: tasa 0%, tributo 9995. */
export const AFECTACION_EXPORTACION = '40';

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

/**
 * Unidades de medida del Catálogo 03 usadas en una ferretería (TA-62).
 *
 * El nombre es el `unitCode` exacto que SUNAT valida en el
 * `cbc:InvoicedQuantity`; el símbolo es lo que se muestra en pantalla. Se
 * incluye la descripción de la unidad del sistema internacional para que la
 * cajera entienda qué significa "BG" (saco o bolsa) frente a "BX" (caja).
 */
export const CATALOGO_03_UNIDADES = {
  NIU: { nombre: 'Unidad', simbolo: 'UND' },
  DZN: { nombre: 'Docena', simbolo: 'DOC' },
  CEN: { nombre: 'Ciento', simbolo: 'CIO' },
  MIL: { nombre: 'Millar', simbolo: 'MLL' },
  KGM: { nombre: 'Kilogramo', simbolo: 'KG' },
  MTR: { nombre: 'Metro', simbolo: 'M' },
  BG: { nombre: 'Bolsa', simbolo: 'BLS' },
  BX: { nombre: 'Caja', simbolo: 'CJA' },
} as const;

/** Unidades de ferretería válidas, para validar el DTO y la grilla del front. */
export const UNIDADES_FERRETERIA: readonly string[] = Object.keys(
  CATALOGO_03_UNIDADES,
);

/** Descuentos del Catálogo 53; el nivel evita usar códigos globales en una línea. */
export const CATALOGO_53_DESCUENTOS = {
  '00': { descripcion: 'Descuentos que afectan la base imponible del IGV/IVAP', nivel: 'ITEM' },
  '01': { descripcion: 'Descuentos que no afectan la base imponible del IGV/IVAP', nivel: 'ITEM' },
  '02': { descripcion: 'Descuentos globales que afectan la base imponible del IGV/IVAP', nivel: 'GLOBAL' },
  '03': { descripcion: 'Descuentos globales que no afectan la base imponible del IGV/IVAP', nivel: 'GLOBAL' },
  '04': { descripcion: 'Descuentos globales por anticipos gravados que afectan la base imponible del IGV/IVAP', nivel: 'GLOBAL' },
} as const;

/** Catálogo 54: código de bien o servicio sujeto a detracción (SPOT). */
export const CATALOGO_54_DETRACCION = {
  '012': { descripcion: 'Intermediación laboral y tercerización', porcentaje: 0.12 },
  '019': { descripcion: 'Arrendamiento de bienes', porcentaje: 0.1 },
  '022': { descripcion: 'Otros servicios empresariales', porcentaje: 0.12 },
  '027': { descripcion: 'Flete terrestre', porcentaje: 0.04 },
  '035': { descripcion: 'Bienes exonerados del IGV', porcentaje: 0.015 },
  '037': { descripcion: 'Demás servicios gravados con el IGV', porcentaje: 0.12 },
  '039': { descripcion: 'Minerales no metálicos', porcentaje: 0.1 },
} as const;

/**
 * Códigos del Catálogo 54 que SUNAT retiró (TA-63).
 *
 * Existen en los sistemas viejos y en muchas plantillas de Excel, pero emitir
 * con uno de ellos produce un rechazo. Se rechazan en la validación con un
 * mensaje claro en lugar de dejar que SUNAT lo descubra después del envío.
 */
export const CODIGOS_DETRACCION_DADOS_DE_BAJA: readonly string[] = [
  '006',
  '018',
  '029',
  '033',
];

/** Umbral en soles por encima del cual la detracción es obligatoria (SPOT). */
export const UMBRAL_DETRACCION_SOLES = 700;

/** Tasa del IGV vigente. */
export const TASA_IGV = 0.18;

/** Tasa de la retención del IGV aplicada por agente de retención. */
export const TASA_RETENCION_IGV = 0.03;

/** Impuesto a las bolsas plásticas (ICBPER) por bolsa, en soles. */
export const MONTO_ICBPER_POR_BOLSA = 0.5;

export * from './sunatCatalogsQuery';
