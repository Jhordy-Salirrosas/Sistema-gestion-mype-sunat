/**
 * Contrato de la emisión desde la pantalla (M1).
 *
 * Es el espejo de `EmitirComprobanteDto` del backend. Se mantiene en un archivo
 * aparte de `invoice.types.ts` porque ese contiene el modelo del LISTADO, y
 * mezclar el alta con la consulta fue justo lo que produjo el error de contrato
 * del 31-10: el formulario mandaba campos del listado a un endpoint que esperaba
 * datos fiscales.
 */

/** Tipos que se pueden emitir desde el formulario. */
export type TipoEmisionPantalla = '01' | '03' | '07' | '08';

/** Afectaciones del Catálogo 07 que admite la grilla. */
export type AfectacionGrilla =
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '20'
  | '21'
  | '30'
  | '31'
  | '32'
  | '33'
  | '34'
  | '35'
  | '36'
  | '37'
  | '40';

/** Una línea tal como la manda la pantalla. */
export interface LineaEmisionPayload {
  descripcion: string;
  /** SKU del producto: es lo que permite validar stock y mover el Kardex. */
  codigo?: string;
  /** Unidad del Catálogo 03 (NIU, KGM, DZN...). */
  unidad?: string;
  cantidad: number;
  /** Valor unitario SIN IGV. */
  valorUnitario: number;
  /** Precio unitario final CON IGV incluido digitado en la venta. */
  precioUnitario?: number;
  afectacion?: AfectacionGrilla;
  descuento?: { codigo: '00' | '01'; monto: number } | null;
  /** Código del Catálogo 54 cuando la línea está sujeta a detracción. */
  codigoDetraccion?: string;
  /** ICBPER de la línea cuando es una bolsa plástica. */
  icbper?: number;
  cantidadBolsas?: number;
}

/** Alta de comprobante desde la pantalla. */
export interface EmitirComprobantePayload {
  almacen?: string;
  medio_pago_detraccion?: import('../lib/medioPagoDetraccion').MedioPagoDetraccion;
  tipo_comprobante: TipoEmisionPantalla;
  serie: string;
  customer_identity_type?: string;
  customer_identity_number?: string;
  customer_legal_name: string;
  customer_address?: string;
  /** YYYY-MM-DD; si falta, el backend usa la fecha del servidor. */
  fecha_emision?: string;
  agente_retencion?: boolean;
  correccion_retencion?: boolean;
  forma_pago?: 'Contado' | 'Credito';
  /**
   * Cronograma de la venta al crédito (HU-10). Obligatorio cuando
   * `forma_pago` es 'Credito': el backend exige al menos una cuota y comprueba
   * que sumen el neto pendiente (regla 3319) y que cada vencimiento sea
   * posterior a la emisión (regla 3267).
   */
  cuotas?: readonly { monto: number; vencimiento: string }[];
  items: readonly LineaEmisionPayload[];
  descuento_global?: { codigo: '02' | '03'; monto: number } | null;
  /** Notas (07/08): comprobante que se modifica. Obligatorio en notas. */
  documento_afectado?: string;
  codigo_motivo_nota?: string;
  descripcion_motivo_nota?: string;
}

/** Importes ya liquidados por el backend. */
export interface ImportesEmision {
  gravado: number;
  igv: number;
  exonerado: number;
  inafecto: number;
  icbper: number;
  detraccion: number;
  retencion: number;
  total: number;
  importePagar: number;
}

/** Lo que devuelve `POST /invoices/emitir`. */
export interface ResultadoEmisionBackend {
  success: boolean;
  /** Número real asignado por la serie, p. ej. F001-00000001. */
  numero: string;
  serie: string;
  correlativo: number;
  tipo_comprobante: string;
  monto_total: number;
  importes: ImportesEmision;
  /** Avisos no bloqueantes (por ejemplo, líneas sin código de producto). */
  avisos: readonly string[];
  lineas: readonly {
    descripcion: string;
    cantidad: number;
    unidad: string;
    valor_unitario: number;
    igv: number;
    total: number;
  }[];
}
