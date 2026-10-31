/**
 * Contrato de los endpoints de consulta de comprobantes (TA-29).
 *
 * El objetivo de la tarea es retirar los datos de demostración de la consola
 * fiscal: el frontend debe recibir lo que la base tiene. Eso obliga a que las
 * respuestas tengan EXACTAMENTE la forma que el frontend ya sabe leer
 * (`invoicesApi.ts` / `invoice.types.ts` del repo del front), y a que el
 * listado venga paginado.
 *
 * Estos DTO se declaran a mano y no con `class-validator` porque son de
 * SALIDA: nadie los recibe del cliente, así que validarlos no aporta y sí
 * añade ceremonia.
 */
import type { InvoiceStatus } from '../../../../generated/client/enums';

/** Estado tal como lo pinta la tabla del frontend. */
export type EstadoComprobante = InvoiceStatus;

/** Un comprobante del listado, con lo justo para la grilla. */
export interface ComprobanteListadoDto {
  id: string;
  tipo_comprobante: string;
  serie: string;
  correlativo: number;
  /** Serie y número juntos: F001-00000007, como los muestra la UI. */
  numero: string;
  fecha_emision: string;
  estado: EstadoComprobante;
  monto_total: number;
  moneda: string;
  cliente_documento: string | null;
  cliente_nombre: string | null;
  /** Código del CDR si ya se recibió, `null` mientras no haya respuesta. */
  cdr_codigo: string | null;
}

/** Página de resultados. */
export interface PaginaComprobantesDto {
  data: ComprobanteListadoDto[];
  /** Total de filas que cumplen los filtros, no las de esta página. */
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Una transición de estado del comprobante. */
export interface HistorialEstadoDto {
  id: string;
  intento: number;
  estado_anterior: EstadoComprobante | null;
  estado_nuevo: EstadoComprobante;
  codigo_error: string | null;
  mensaje_error: string | null;
  tiempo_respuesta_ms: number | null;
  created_at: string;
}

/** CDR ya recibido, aplanado para la ficha del comprobante. */
export interface CdrDto {
  codigo: string | null;
  descripcion: string | null;
  fecha_respuesta: string | null;
  observaciones: Array<{ codigo: string | null; texto: string }>;
}

/** Detalle completo de un comprobante (GET /invoices/:id). */
export interface ComprobanteDetalleDto extends ComprobanteListadoDto {
  ruc_emisor: string;
  base_imponible: number;
  total_igv: number;
  cdr: CdrDto | null;
  historial: HistorialEstadoDto[];
  created_at: string;
  updated_at: string;
}

/** Respuesta del reintento de CDR. */
export interface ReintentoCdrDto {
  id: string;
  estado: EstadoComprobante;
  encolado: boolean;
  mensaje: string;
}

/** Filtros aceptados por el listado. */
export interface FiltrosComprobantes {
  estado?: string;
  tipo?: string;
  serie?: string;
  desde?: string;
  hasta?: string;
}
