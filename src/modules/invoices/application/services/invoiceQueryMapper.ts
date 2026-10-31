/**
 * Mapeadores de modelo a DTO (TA-29).
 *
 * Funciones puras: reciben una fila de Prisma y devuelven la forma exacta que
 * consume el frontend. Al ser puras se prueban sin base de datos y se evita
 * que la conversión se duplique en el listado y en el detalle (donde una
 * divergencia provocaría que la fila de la grilla y la ficha del mismo
 * comprobante muestren datos distintos).
 */
import type {
  CdrDto,
  ComprobanteDetalleDto,
  ComprobanteListadoDto,
  HistorialEstadoDto,
} from '../dto/invoiceQueryDto';
import type { InvoiceStatus } from '../../../../generated/client/enums';

/** Fila del listado (lo que se le pide a Prisma con `select`). */
export interface FilaListado {
  id: string;
  tipo_comprobante: string;
  serie: string;
  correlativo: number;
  fecha_emision: Date;
  estado: InvoiceStatus;
  monto_total: { toString(): string } | number;
  currency_code: string;
  customer_identity_number: string | null;
  customer_legal_name: string | null;
  sunat_response_code: string | null;
  taxable_operations?: { toString(): string } | number;
  total_igv?: { toString(): string } | number;
  exempt_operations?: { toString(): string } | number;
  unaffected_operations?: { toString(): string } | number;
  referenced_series_correlative?: string | null;
  xml_hash_sha256?: string | null;
}

/** Fila del detalle: la del listado más los campos de la ficha. */
export interface FilaDetalle extends FilaListado {
  ruc_emisor: string;
  taxable_operations: { toString(): string } | number;
  total_igv: { toString(): string } | number;
  cdr_sunat: unknown;
  created_at: Date;
  updated_at: Date;
  history: Array<{
    id: string;
    intento: number;
    estado_anterior: InvoiceStatus | null;
    estado_nuevo: InvoiceStatus;
    codigo_error: string | null;
    mensaje_error: string | null;
    tiempo_respuesta_ms: number | null;
    created_at: Date;
  }>;
}

/** Los Decimal de Prisma llegan como objeto; se convierten a número. */
function numero(valor: { toString(): string } | number): number {
  const n = typeof valor === 'number' ? valor : Number(valor.toString());
  return Number.isFinite(n) ? n : 0;
}

/** Serie y número con el relleno que usa SUNAT en el XML: F001-00000007. */
export function numeroComprobante(serie: string, correlativo: number): string {
  return `${serie}-${String(correlativo).padStart(8, '0')}`;
}

export function aListado(fila: FilaListado): ComprobanteListadoDto {
  return {
    id: fila.id,
    tipo_comprobante: fila.tipo_comprobante,
    serie: fila.serie,
    correlativo: fila.correlativo,
    numero: numeroComprobante(fila.serie, fila.correlativo),
    fecha_emision: fila.fecha_emision.toISOString(),
    estado: fila.estado,
    monto_total: numero(fila.monto_total),
    moneda: fila.currency_code,
    cliente_documento: fila.customer_identity_number,
    cliente_nombre: fila.customer_legal_name,
    cdr_codigo: fila.sunat_response_code,
    base_imponible: numero(fila.taxable_operations ?? 0),
    total_igv: numero(fila.total_igv ?? 0),
    exonerada: numero(fila.exempt_operations ?? 0),
    inafecta: numero(fila.unaffected_operations ?? 0),
    documento_afectado: fila.referenced_series_correlative ?? null,
    hash_cpe: fila.xml_hash_sha256 ?? null,
  };
}

/**
 * Aplana el JSON del CDR guardado en `Invoice.cdr_sunat`.
 *
 * El JSON lo escribe `CdrPersistenceService` con una forma conocida, pero al
 * venir de la base no hay garantía de tipo: se lee de forma defensiva y, si no
 * tiene la forma esperada, se devuelve `null` en vez de romper el detalle.
 */
export function aCdr(valor: unknown): CdrDto | null {
  if (!valor || typeof valor !== 'object') return null;

  const cdr = valor as Record<string, unknown>;
  const observaciones = Array.isArray(cdr.observaciones)
    ? cdr.observaciones.map((o) => {
        const obs = (o ?? {}) as Record<string, unknown>;
        return {
          codigo: obs.codigo === null || obs.codigo === undefined
            ? null
            : String(obs.codigo),
          texto: String(obs.texto ?? ''),
        };
      })
    : [];

  return {
    codigo: cdr.responseCode === null || cdr.responseCode === undefined
      ? null
      : String(cdr.responseCode),
    descripcion: cdr.description === null || cdr.description === undefined
      ? null
      : String(cdr.description),
    fecha_respuesta:
      cdr.responseDate === null || cdr.responseDate === undefined
        ? null
        : String(cdr.responseDate),
    observaciones,
  };
}

export function aHistorial(
  filas: FilaDetalle['history'],
): HistorialEstadoDto[] {
  // Orden cronológico ascendente: el frontend lo pinta como línea de tiempo.
  return [...filas]
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    .map((fila) => ({
      id: fila.id,
      intento: fila.intento,
      estado_anterior: fila.estado_anterior,
      estado_nuevo: fila.estado_nuevo,
      codigo_error: fila.codigo_error,
      mensaje_error: fila.mensaje_error,
      tiempo_respuesta_ms: fila.tiempo_respuesta_ms,
      created_at: fila.created_at.toISOString(),
    }));
}

export function aDetalle(fila: FilaDetalle): ComprobanteDetalleDto {
  return {
    ...aListado(fila),
    ruc_emisor: fila.ruc_emisor,
    base_imponible: numero(fila.taxable_operations),
    total_igv: numero(fila.total_igv),
    cdr: aCdr(fila.cdr_sunat),
    historial: aHistorial(fila.history),
    created_at: fila.created_at.toISOString(),
    updated_at: fila.updated_at.toISOString(),
  };
}
