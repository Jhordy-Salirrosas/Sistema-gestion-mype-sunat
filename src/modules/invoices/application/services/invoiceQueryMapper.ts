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
  CuotaEnviadaDto,
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
}

/** Fila del detalle: la del listado más los campos de la ficha. */
export interface FilaDetalle extends FilaListado {
  ruc_emisor: string;
  taxable_operations: { toString(): string } | number;
  total_igv: { toString(): string } | number;
  cdr_sunat: unknown;
  /** Payload UBL con el que se generó el XML; de ahí sale el cronograma. */
  payload_ubl?: unknown;
  /** Referencia de una nota al documento afectado (07/08). */
  referenced_document_type?: string | null;
  referenced_series_correlative?: string | null;
  credit_debit_reason_code?: string | null;
  /** SHA-256 del XML firmado; `null` si aún no se guardó. */
  xml_hash_sha256?: string | null;
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

/**
 * Código y motivo del ÚLTIMO rechazo registrado en el historial.
 *
 * POR QUÉ HACE FALTA
 *
 * Cuando SUNAT rechaza por una regla de negocio devuelve un CDR con su código.
 * Pero cuando el rechazo llega como SOAP Fault (por ejemplo la regla 2992) no
 * hay CDR que guardar: `cdr_sunat` queda NULL y el motivo vive solo en
 * `transaction_history`. Sin exponerlo, la pantalla no tenía código ni
 * descripción y rotulaba el comprobante como "PENDIENTE", que es el estado
 * contrario a "RECHAZADO".
 *
 * Se toma el último intento que dejó un mensaje, que es el veredicto final.
 */
export function ultimoErrorDelHistorial(
  historial: readonly {
    estado_nuevo: string;
    codigo_error: string | null;
    mensaje_error: string | null;
  }[],
): { ultimo_error_codigo: string | null; ultimo_error_mensaje: string | null } {
  for (let i = historial.length - 1; i >= 0; i -= 1) {
    const fila = historial[i];
    if (fila && fila.estado_nuevo === 'RECHAZADO') {
      return {
        ultimo_error_codigo: fila.codigo_error ?? null,
        ultimo_error_mensaje: fila.mensaje_error ?? null,
      };
    }
  }

  return { ultimo_error_codigo: null, ultimo_error_mensaje: null };
}

/**
 * Forma de pago y cronograma leídos del payload UBL que se envió a SUNAT.
 *
 * POR QUÉ HACE FALTA
 *
 * `invoices` no guarda la forma de pago: el dato vive solo dentro de
 * `payload_ubl`, que es el JSON del que se generó el XML. Al no exponerlo, el
 * front no tenía de dónde sacarlo y rellenaba `formaPago: 'Contado'` con
 * `cuotas: []` para TODA fila. La consecuencia visible: la factura al crédito
 * F001-00000056 —con dos cuotas de 885.00 en su `cac:PaymentTerms`— se abría
 * como una venta al contado sin cronograma.
 *
 * Se lee de forma defensiva porque el JSON viene de la base y su forma ha
 * cambiado entre versiones: ante cualquier duda se devuelve `null` (forma de
 * pago desconocida) en vez de inventar "Contado", que afirmaría un dato fiscal
 * que no se comprobó.
 */
export function condicionesDePago(payload: unknown): {
  forma_pago: 'Contado' | 'Credito' | null;
  cuotas: CuotaEnviadaDto[];
} {
  if (!payload || typeof payload !== 'object') {
    return { forma_pago: null, cuotas: [] };
  }

  const datos = payload as Record<string, unknown>;
  const formaPago = datos.formaPago;
  const forma_pago =
    formaPago === 'Credito' || formaPago === 'Contado' ? formaPago : null;

  if (!Array.isArray(datos.cuotas)) return { forma_pago, cuotas: [] };

  const cuotas: CuotaEnviadaDto[] = [];
  for (const crudo of datos.cuotas) {
    if (!crudo || typeof crudo !== 'object') continue;
    const cuota = crudo as Record<string, unknown>;
    cuotas.push({
      numero: String(cuota.numero ?? `Cuota${String(cuotas.length + 1).padStart(3, '0')}`),
      monto: numero(cuota.monto as { toString(): string } | number),
      // El contrato guarda la fecha como `YYYY-MM-DD`; si viniera con hora se
      // recorta para que el front no tenga que adivinarlo.
      vencimiento: String(cuota.vencimiento ?? '').slice(0, 10),
    });
  }

  return { forma_pago, cuotas };
}

export function aDetalle(fila: FilaDetalle): ComprobanteDetalleDto {  return {
    ...aListado(fila),
    ruc_emisor: fila.ruc_emisor,
    base_imponible: numero(fila.taxable_operations),
    total_igv: numero(fila.total_igv),
    // Referencia de las notas. Se publican tal cual: son `null` en facturas y
    // boletas, que no afectan a ningún documento, y así el front no tiene que
    // adivinar si la ausencia significa "no aplica" o "no se guardó".
    referenced_document_type: fila.referenced_document_type ?? null,
    referenced_series_correlative: fila.referenced_series_correlative ?? null,
    credit_debit_reason_code: fila.credit_debit_reason_code ?? null,
    ...condicionesDePago(fila.payload_ubl),
    /**
     * SHA-256 del XML FIRMADO que se envió a SUNAT.
     *
     * Permite verificar que el archivo descargado es exactamente el que viajó.
     * Antes la columna quedaba en NULL (nadie la escribía) y la pantalla decía
     * "No disponible en esta vista".
     */
    hash_xml: fila.xml_hash_sha256 ?? null,
    ...ultimoErrorDelHistorial(fila.history),
    cdr: aCdr(fila.cdr_sunat),
    historial: aHistorial(fila.history),
    created_at: fila.created_at.toISOString(),
    updated_at: fila.updated_at.toISOString(),
  };
}
