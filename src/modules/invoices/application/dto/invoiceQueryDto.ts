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
  /** SHA-256 del XML firmado que se envió; `null` si no se guardó. */
  hash_xml: string | null;
  /**
   * Código y motivo del último rechazo, tomados del historial.
   *
   * Cubre el caso en que SUNAT rechaza por SOAP Fault y no hay CDR: sin estos
   * dos campos la pantalla no tenía el porqué y mostraba "PENDIENTE" sobre un
   * comprobante ya rechazado. Son `null` si nunca fue rechazado.
   */
  ultimo_error_codigo: string | null;
  ultimo_error_mensaje: string | null;
  /**
   * Forma de pago y cronograma DE LO QUE SE ENVIÓ a SUNAT.
   *
   * No son columnas de `invoices`: el cronograma solo existe dentro del payload
   * UBL que generó el XML, y no había forma de leerlo de vuelta. El front, al
   * no tenerlo, pintaba toda fila como "Contado" y la factura al crédito
   * aparecía sin cronograma aunque el XML llevara sus `cac:PaymentTerms`
   * Cuota001/Cuota002.
   *
   * `forma_pago` es `null` en los comprobantes anteriores a que existiera el
   * campo: se desconoce, y decirlo así es mejor que suponer "Contado".
   */
  forma_pago: 'Contado' | 'Credito' | null;
  cuotas: CuotaEnviadaDto[];
  cdr: CdrDto | null;
  historial: HistorialEstadoDto[];
  created_at: string;
  updated_at: string;
}

/** Una cuota tal como viajó en el `cac:PaymentTerms` del XML. */
export interface CuotaEnviadaDto {
  /** `Cuota001`, `Cuota002`…, el `PaymentMeansID` del XML. */
  numero: string;
  monto: number;
  /** Vencimiento en formato corto (`YYYY-MM-DD`). */
  vencimiento: string;
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
