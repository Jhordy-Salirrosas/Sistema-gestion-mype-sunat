/** Motivo del Catálogo 09 (Nota de Crédito). */
export interface MotivoCredito {
  codigo: string;
  descripcion: string;
  /**
   * ¿Devuelve el importe completo del comprobante?
   *
   * Los motivos marcados como totales implican devolver todo, así que no
   * se les pide importe: se toma el saldo disponible entero.
   */
  total: boolean;
}

/** Motivo del Catálogo 10 (Nota de Débito). */
export interface MotivoDebito {
  codigo: string;
  descripcion: string;
}

/** Catálogo 09 de SUNAT: motivos de Nota de Crédito. */
export const CATALOGO_09_MOTIVOS: readonly MotivoCredito[] = [
  { codigo: '01', descripcion: 'Anulación de la operación', total: true },
  { codigo: '02', descripcion: 'Anulación por error en el RUC', total: true },
  { codigo: '03', descripcion: 'Corrección por error en la descripción', total: false },
  { codigo: '04', descripcion: 'Descuento global', total: false },
  { codigo: '05', descripcion: 'Descuento por ítem', total: false },
  { codigo: '06', descripcion: 'Devolución total', total: true },
  { codigo: '07', descripcion: 'Devolución por ítem', total: false },
  { codigo: '09', descripcion: 'Disminución en el valor', total: false },
  { codigo: '10', descripcion: 'Otros conceptos', total: false },
  { codigo: '13', descripcion: 'Ajustes de montos y/o fechas de pago al crédito', total: false },
];

/** Catálogo 10 de SUNAT: motivos de Nota de Débito. */
export const CATALOGO_10_MOTIVOS: readonly MotivoDebito[] = [
  { codigo: '01', descripcion: 'Intereses por mora' },
  { codigo: '02', descripcion: 'Aumento en el valor' },
  { codigo: '03', descripcion: 'Penalidades / otros conceptos' },
  { codigo: '11', descripcion: 'Ajustes de operaciones de exportación' },
  { codigo: '12', descripcion: 'Ajustes afectos al IVAP' },
];

/** Única definición de totalidad monetaria y de cantidades para notas de crédito. */
export function esMotivoCreditoTotal(codigo: string | null | undefined): boolean {
  return CATALOGO_09_MOTIVOS.find(m => m.codigo === codigo)?.total ?? false;
}
