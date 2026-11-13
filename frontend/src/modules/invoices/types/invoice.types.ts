import type { ImportesBandeja } from '../lib/invoiceBandejaAmounts';
import type { ResultadoPresentacion } from '../lib/invoiceResultPresentation';
/**
 * Estado de un comprobante frente a SUNAT, tal como lo pinta el front.
 *
 * POR QUÉ `SIN_CONFIRMAR` EXISTE (deuda A, cerrada el 3 nov)
 *
 * Antes `ERROR_RED` se colapsaba en `FALLO_CRITICO`, que la grilla rotulaba
 * "En Cola DLQ" y el modal convertía en RECHAZADO. Las dos etiquetas eran
 * falsas: el comprobante ni está en la DLQ por el hecho de tener un error de
 * red, ni fue rechazado por SUNAT — nunca le llegó.
 *
 * `FALLO_CRITICO` se conserva por compatibilidad de datos ya guardados, pero
 * **nada del backend lo produce**: `MAPA_ESTADOS` manda `ERROR_RED` a
 * `SIN_CONFIRMAR`. Es el único estado que NO es un veredicto.
 */
export type CdrStatus =
  | 'EN_COLA_OUTBOX'
  | 'ACEPTADO_SUNAT'
  | 'SIN_CONFIRMAR'
  /** @deprecated nada lo produce; ver el comentario de arriba. */
  | 'FALLO_CRITICO'
  | 'RECHAZADO_SUNAT';

/** Moneda del comprobante. */
export type Moneda = 'PEN' | 'USD';

export interface InvoiceItem {
  id?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  igv: number;
  total: number;
}

/** Resumen del comprobante afectado por una nota de crédito o débito (07/08). */
export interface ComprobanteOrigenNota {
  id: string | null;
  tipoComprobante: string | null;
  serie: string | null;
  correlativo: number | null;
  numero: string;
  clienteDocumento: string | null;
  clienteNombre: string | null;
  montoTotal: number | null;
  moneda: string | null;
}

export interface Invoice {
  /** null indica que la cola no pudo consultarse; nunca se infiere del historial. */
  enDlq?: boolean | null;
  importesBandeja?: ImportesBandeja;
  transporteAcreditado?: boolean;
  montoDetraccion?: number | null;
  montoRetencion?: number | null;
  resultadoPresentacion?: ResultadoPresentacion;
  tieneCdr?: boolean;
  lineasOrigen?: readonly LineaOrigen[];
  historial?: readonly { id: string; fecha: string; mensaje: string | null }[];
  id: string;
  serie: string;
  /** Número completo que asigna el backend: F001-00000007. */
  numero: string;
  /**
   * Correlativo sin la serie. El backend lo devuelve siempre y sirve para
   * reconocer el comprobante cuando alguien teclea solo el número suelto.
   */
  correlativo?: number;
  clienteRuc: string;
  clienteRazonSocial: string;
  fechaEmision: string;
  moneda: Moneda;
  subtotal: number;
  igv: number;
  total: number;
  cdrStatus: CdrStatus;
  cdrCodigo?: string;
  cdrMensaje?: string;
  /**
   * Código y motivo del último rechazo, cuando no hay CDR.
   *
   * Un rechazo puede llegar por SOAP Fault en lugar de ApplicationResponse; en
   * ese caso `cdrCodigo` viene vacío y la pantalla lo rotulaba como PENDIENTE.
   * Estos dos campos vienen del historial y son el único rastro del veredicto.
   */
  ultimoErrorCodigo?: string;
  ultimoErrorMensaje?: string;
  /**
   * SHA-256 del XML firmado que se envió a SUNAT.
   *
   * Lo devuelve el endpoint de detalle. Permite comprobar que el archivo
   * descargado es exactamente el que viajó; si falta, la pantalla lo dice en
   * lugar de mostrar un valor inventado.
   */
  hashCpe?: string;
  items?: InvoiceItem[];
  /**
   * Tipo del Catálogo 01 (01 Factura, 03 Boleta, 07 NC, 08 ND).
   *
   * TA-59: el modelo del front no contemplaba el tipo aunque el backend lo
   * devuelve siempre, así que la grilla no podía ni mostrar ni filtrar por él.
   */
  tipoComprobante: string;
  /**
   * Estado CRUDO del backend (ACEPTADO, EN_COLA, ERROR_RED...).
   *
   * Se conserva además del `cdrStatus` porque el reintento y el badge de
   * «OBSERVADO» necesitan distinguir estados que el status de CDR colapsa: un
   * comprobante OBSERVADO y uno ACEPTADO son ambos ACEPTADO_SUNAT, pero solo el
   * primero muestra el aviso.
   */
  estadoBackend?: string;
  /** ¿Admite reintento según el estado del backend? */
  reintentable?: boolean;
  /**
   * Forma de pago con la que se emitió, leída del `payload_ubl` del backend.
   *
   * Antes no existía y la pantalla de auditoría asumía "Contado" para toda
   * fila, así que la factura al crédito aparecía sin cronograma. `null` o
   * ausente significa DESCONOCIDA (comprobantes anteriores al campo), no
   * "Contado".
   */
  formaPago?: 'Contado' | 'Credito' | null;
  /** Cronograma que viajó en el `cac:PaymentTerms` del XML. */
  cuotas?: readonly {
    numero: string;
    monto: number;
    vencimiento: string;
  }[];
  /**
   * Documento que modifica una nota (07/08): `F001-00000053`.
   *
   * Viene de `referenced_series_correlative`, una columna de `invoices`. En
   * facturas y boletas es `undefined` porque no afectan a ningún documento.
   */
  documentoAfectado?: string;
  /** Resumen del comprobante origen en notas de crédito/débito. */
  comprobanteOrigen?: ComprobanteOrigenNota | null;
  /** Motivo de la nota (Catálogo 09) tal como se guardó: `06`. */
  motivoNota?: { codigo: string; descripcion: string };
}

export interface LineaOrigen {
  codigo: string | null; descripcion: string | null; unidad: string | null;
  cantidad: number | null; valor_unitario: number | null; precio_unitario: number | null;
  afectacion: string | null; icbper?: number | null;
  descuentos?: readonly { codigo: string | null; monto: number | null }[];
}

export interface CreateInvoiceDto {
  serie: string;
  clienteRuc: string;
  clienteRazonSocial: string;
  moneda: Moneda;
  items: Omit<InvoiceItem, 'id' | 'subtotal' | 'igv' | 'total'>[];
}

/** Fila del listado tal como la devuelve el backend (TA-29, snake_case). */
export interface InvoiceListado {
  transporte_acreditado?: boolean;
  monto_detraccion?: number | null;
  monto_retencion?: number | null;
  resultado_presentacion?: ResultadoPresentacion;
  id: string;
  tipo_comprobante: string;
  serie: string;
  correlativo: number;
  /** Serie y correlativo ya formateados por el backend: F001-00000007. */
  numero: string;
  fecha_emision: string;
  estado: string;
  monto_total: number;
  moneda: string;
  cliente_documento: string | null;
  cliente_nombre: string | null;
  cdr_codigo: string | null;
  /** Montos reales del comprobante; el backend los agrega en TA-29. */
  base_imponible?: number;
  total_igv?: number;
  exonerada?: number;
  inafecta?: number;
  documento_afectado?: string | null;
  credit_debit_reason_code?: string | null;
  comprobante_origen?: {
    id: string | null;
    tipo_comprobante: string | null;
    serie: string | null;
    correlativo: number | null;
    numero: string;
    cliente_documento: string | null;
    cliente_nombre: string | null;
    monto_total: number | null;
    moneda: string | null;
  } | null;
  hash_cpe?: string | null;
  cdr_descripcion?: string | null;
  forma_pago?: 'Contado' | 'Credito' | null;
  cuotas?: readonly {
    numero: string;
    monto: number;
    vencimiento: string;
  }[];
}

/** Página de comprobantes que devuelve `GET /invoices`. */
export interface PaginaComprobantes {
  data: InvoiceListado[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Payload de alta del comprobante (POST /invoices). */
export interface CreateInvoicePayload {
  ruc_emisor: string;
  serie: string;
  correlativo: number;
  tipo_comprobante: string;
  monto_total: number;
  fecha_emision: string;
  /** Contrato del generador UBL del backend (`InvoicePayload`). */
  payload_ubl: Record<string, unknown>;
}
