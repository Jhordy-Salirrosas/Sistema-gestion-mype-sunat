/**
 * Validaciones del formulario de emisión de comprobantes (M1).
 *
 * TypeScript puro: sin React. Se aísla de `InvoiceEmitModal.tsx` para mantener
 * ambos archivos por debajo del límite de líneas.
 *
 * Reglas del Catálogo 06 de SUNAT que se aplican aquí:
 *  - La Factura (01) solo puede emitirse a un RUC de 11 dígitos.
 *  - La Boleta (03) se emite a un DNI de 8 dígitos.
 *  - Las Notas (07 y 08) heredan el adquirente del documento que modifican.
 */

/** Tipo de comprobante emisible desde el formulario. */
export type TipoEmisible = '01' | '03' | '07' | '08';

/** Valida un RUC peruano con el algoritmo módulo 11. */
export const rucValido = (ruc: string): boolean => {
  if (!/^\d{11}$/.test(ruc)) return false;
  if (
    !ruc.startsWith('10') &&
    !ruc.startsWith('15') &&
    !ruc.startsWith('17') &&
    !ruc.startsWith('20')
  ) {
    return false;
  }

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digitos = ruc
    .slice(0, 10)
    .split('')
    .map(Number);
  const suma = digitos.reduce((acc, d, i) => acc + d * pesos[i], 0);
  const resto = suma % 11;
  const verificador = 11 - resto;
  /*
   * Dos casos especiales del módulo 11:
   *
   *   resto 1 → 11 - 1 = 10 → el dígito es 0 (p. ej. 20100070970)
   *   resto 0 → 11 - 0 = 11 → el dígito es 1
   *
   * Comprobado contra RUC reales: 20100070970 tiene resto 1 y verificador 0;
   * 20601012341 tiene resto 10 y verificador 1. Estas dos ramas son correctas.
   */
  const digitoFinal =
    verificador === 10 ? 0 : verificador === 11 ? 1 : verificador;

  return digitoFinal === Number(ruc[10]);
};

/** Valida un DNI de 8 dígitos. */
export const dniValido = (dni: string): boolean => /^\d{8}$/.test(dni);

/** Valida el documento del cliente: RUC de 11 dígitos o DNI de 8. */
export const documentoClienteValido = (doc: string): boolean =>
  doc.length === 11 ? rucValido(doc) : dniValido(doc);

/**
 * Valida el documento del cliente según el tipo de comprobante.
 *
 * Una Boleta emitida a un RUC es un comprobante inexistente ante SUNAT, por eso
 * no basta con que el documento sea válido en abstracto: debe corresponder al
 * tipo. Las notas (07/08) aceptan RUC o DNI porque heredan el cliente del
 * documento que modifican.
 */
export const documentoValidoParaTipo = (
  tipo: TipoEmisible,
  doc: string,
): boolean => {
  if (tipo === '01') return rucValido(doc);
  if (tipo === '03') return dniValido(doc);
  return documentoClienteValido(doc);
};

/** Mensaje de error del documento del cliente según el tipo de comprobante. */
export const mensajeErrorDocumento = (tipo: TipoEmisible): string => {
  if (tipo === '01') return 'La Factura exige un RUC válido (módulo 11)';
  if (tipo === '03') return 'La Boleta exige un DNI válido de 8 dígitos';
  return 'Documento inválido (RUC módulo 11 o DNI de 8 dígitos)';
};

/** Serie sugerida para cada tipo de comprobante. */
export const SERIES_POR_TIPO: Record<string, readonly string[]> = {
  '01': ['F001', 'F002'],
  '03': ['B001', 'B002'],
  '07': ['FC01', 'BC01'],
  '08': ['FD01', 'BD01'],
};

/** Serie por defecto que corresponde a cada tipo de comprobante. */
export const serieInicialPorTipo = (tipo: TipoEmisible): string =>
  SERIES_POR_TIPO[tipo]?.[0] ?? 'F001';

/**
 * Serie correcta para una Nota según el documento afectado.
 *
 * SUNAT exige que la Nota de Crédito a una Factura use una serie que empiece
 * con `F`, y la de una Boleta una que empiece con `B`. Si el documento
 * afectado no permite deducirla, se conserva la serie actual.
 */
export const serieParaNota = (
  tipo: TipoEmisible,
  documentoAfectado: string,
  serieActual: string,
): string => {
  if (tipo !== '07' && tipo !== '08') return serieActual;

  const empiezaConB = /^B/i.test(documentoAfectado.trim());
  const prefijo = tipo === '07' ? 'C' : 'D';
  const opciones = SERIES_POR_TIPO[tipo] ?? [];
  const elegida = empiezaConB
    ? opciones.find((s) => s.startsWith(`B${prefijo}`))
    : opciones.find((s) => s.startsWith(`F${prefijo}`));

  return elegida ?? serieActual;
};

/** Motivos del Catálogo 09 (Nota de Crédito). */
// Fuente de verdad: backend src/modules/invoices/application/services/noteCatalogs.ts.
export const MOTIVOS_NC = [
  { codigo: '01', descripcion: 'Anulación de la operación' },
  { codigo: '02', descripcion: 'Anulación por error en el RUC' },
  { codigo: '03', descripcion: 'Corrección por error en la descripción' },
  { codigo: '04', descripcion: 'Descuento global' },
  { codigo: '05', descripcion: 'Descuento por ítem' },
  { codigo: '06', descripcion: 'Devolución total' },
  { codigo: '07', descripcion: 'Devolución por ítem' },
  { codigo: '09', descripcion: 'Disminución en el valor' },
  { codigo: '10', descripcion: 'Otros conceptos' },
  {
    codigo: '13',
    descripcion: 'Ajustes de montos y/o fechas de pago al crédito',
  },
] as const;

/** Motivos del Catálogo 10 (Nota de Débito). */
export const MOTIVOS_ND = [
  { codigo: '01', descripcion: 'Intereses por mora' },
  { codigo: '02', descripcion: 'Aumento en el valor' },
  { codigo: '03', descripcion: 'Penalidades / otros conceptos' },
  { codigo: '11', descripcion: 'Ajustes de operaciones de exportación' },
  { codigo: '12', descripcion: 'Ajustes afectos al IVAP' },
] as const;

/** Porcentajes de detracción SPOT disponibles (Catálogo 54). */
export const DETRACCIONES = [0, 0.04, 0.1, 0.12] as const;
