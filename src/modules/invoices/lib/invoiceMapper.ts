/**
 * Traducción entre el contrato del backend y el modelo del frontend (TA-59).
 *
 * El backend devuelve los campos en `snake_case` con los nombres de la base
 * (`tipo_comprobante`, `cliente_documento`, `monto_total`, `cdr_codigo`) y los
 * estados del enum de Prisma (`ACEPTADO`, `OBSERVADO`, `EN_COLA`, `ERROR_RED`).
 * El frontend trabaja en `camelCase` con tres estados de CDR
 * (`ACEPTADO_SUNAT`, `FALLO_CRITICO`...).
 *
 * Sin esta capa `invoicesApi.getInvoices` devolvía la respuesta CRUDA: la grilla
 * quedaba vacía porque buscaba `clienteRuc` donde el backend manda
 * `cliente_documento`, y `total` donde manda `monto_total`. Era el trabajo real
 * de TA-59, no "conectar la pantalla": la pantalla ya llamaba al backend.
 *
 * Se escriben dos direcciones:
 *  - `aInvoice` / `aPaginaInvoices`: backend → frontend.
 *  - `aCreateInvoiceDto`: frontend → backend (el alta).
 */
import type {
  CdrStatus,
  Invoice,
  InvoiceItem,
  Moneda,
} from '../types/invoice.types';
import { MOTIVOS_NC, MOTIVOS_ND } from './invoiceEmitValidation';

/** Fila del backend tal como llega por HTTP. */
export interface ComprobanteBackend {
  id: string;
  tipo_comprobante: string;
  serie: string;
  correlativo: number;
  numero: string;
  fecha_emision: string;
  estado: string;
  monto_total: number;
  moneda: string;
  cliente_documento: string | null;
  cliente_nombre: string | null;
  cdr_codigo: string | null;
  documento_afectado?: string | null;
  referenced_series_correlative?: string | null;
}

/** Detalle del backend: la fila más la ficha. */
export interface ComprobanteDetalleBackend extends ComprobanteBackend {
  lineas_origen?: Invoice['lineasOrigen'] | null;
  historial?: readonly { id: string; created_at: string; mensaje_error: string | null }[] | null;
  ruc_emisor: string;
  base_imponible: number;
  total_igv: number;
  /** SHA-256 del XML firmado que se envió a SUNAT. */
  hash_xml?: string | null;
  /**
   * Motivo del rechazo cuando SUNAT no devolvió CDR.
   *
   * Un rechazo puede llegar como SOAP Fault en lugar de ApplicationResponse; en
   * ese caso `cdr` es null pero el código y el mensaje del fault quedan en el
   * historial. Sin este campo, la pantalla no tenía de dónde sacar el porqué y
   * rotulaba el rechazo como "PENDIENTE".
   */
  ultimo_error_codigo?: string | null;
  ultimo_error_mensaje?: string | null;
  /**
   * Forma de pago y cronograma DE LO QUE SE ENVIÓ a SUNAT.
   *
   * Los sirve el detalle leyendo el `payload_ubl` del comprobante, porque en la
   * tabla `invoices` no hay columnas para ellos. `forma_pago` es `null` en los
   * comprobantes anteriores a que el campo existiera.
   */
  forma_pago?: 'Contado' | 'Credito' | null;
  cuotas?: readonly {
    numero: string;
    monto: number;
    vencimiento: string;
  }[];
  /**
   * Referencia de una nota (07/08) al documento que modifica.
   *
   * Son columnas de `invoices` que el detalle publica desde `16fe7c8`. Sin
   * ellas la ficha de una nota aceptada se abría sin origen ni motivo, que es
   * justo lo que el docente pidió ("es sobre el documento que ya está").
   */
  referenced_document_type?: string | null;
  referenced_series_correlative?: string | null;
  credit_debit_reason_code?: string | null;
  cdr: {
    codigo: string | null;
    descripcion: string | null;
    fecha_respuesta: string | null;
    observaciones: readonly { codigo: string | null; texto: string }[];
  } | null;
}

/** Página del listado tal como la devuelve el backend. */
export interface PaginaBackend {
  data: readonly ComprobanteBackend[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Registro estado-del-backend → estado-de-CDR-del-frontend.
 *
 * `OBSERVADO` se mapea a ACEPTADO_SUNAT y no a RECHAZADO_SUNAT a propósito: un
 * comprobante observado existe y es válido ante SUNAT; solo tiene salvedades.
 * Tratarlo como rechazo haría reenviarlo y duplicarlo.
 *
 * `ERROR_RED` se mapea a `SIN_CONFIRMAR` y NO a `FALLO_CRITICO`. El colapso
 * anterior hacía que la grilla lo rotulara "En Cola DLQ" —falso: tener un error
 * de red no implica estar en la cola de muertos— y que el modal lo tratara como
 * RECHAZADO. Un fallo de transmisión no es un veredicto de SUNAT: el documento
 * no le llegó, así que no hay ni rechazo ni aceptación.
 */
export const MAPA_ESTADOS: Record<string, CdrStatus> = {
  ACEPTADO: 'ACEPTADO_SUNAT',
  OBSERVADO: 'ACEPTADO_SUNAT',
  EN_COLA: 'EN_COLA_OUTBOX',
  PENDIENTE: 'EN_COLA_OUTBOX',
  ENVIADO: 'EN_COLA_OUTBOX',
  ERROR_RED: 'SIN_CONFIRMAR',
  RECHAZADO: 'RECHAZADO_SUNAT',
  ANULADO: 'RECHAZADO_SUNAT',
};

/**
 * Traduce el estado, con un valor por defecto seguro.
 *
 * Un estado desconocido NO se convierte en aceptado: se trata como EN_COLA, de
 * modo que la UI no muestra como válido algo que el front no sabe interpretar.
 */
export const aCdrStatus = (estado: string): CdrStatus =>
  MAPA_ESTADOS[estado] ?? 'EN_COLA_OUTBOX';

/** Estados del backend que admiten reintento. */
export const ESTADOS_REINTENTABLES: readonly string[] = [
  'ERROR_RED',
  'ENVIADO',
  'RECHAZADO',
];

/** ¿Se puede reintentar este comprobante? */
export const esReintentable = (estado: string): boolean =>
  ESTADOS_REINTENTABLES.includes(estado);

/** Moneda del backend, con PEN como valor por defecto. */
export const aMoneda = (valor: string | null | undefined): Moneda =>
  valor === 'USD' ? 'USD' : 'PEN';

/** Convierte números que llegan como string (Decimal serializado) a número. */
const numero = (valor: unknown): number => {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Normaliza la fecha de emisión a un día calendario `YYYY-MM-DD`.
 *
 * QUÉ PASABA
 *
 * El backend serializa `fecha_emision` con `toISOString()`, así que una venta
 * del 1 de noviembre en Lima llega como `2026-11-01T00:00:00.000Z`. El front la
 * pasaba tal cual a `formatDateToPeru`, que solo reconoce el formato corto: una
 * cadena con hora cae en `new Date(...)` y, al formatearla en Lima (UTC-5),
 * retrocede al día anterior. La bandeja mostraba 31/10 para un comprobante del
 * 01/11, y no coincidía con la trama QR del mismo documento.
 *
 * Se recorta a la parte de la fecha SIN reconstruir el instante: el campo es un
 * día de calendario fiscal, no un momento del tiempo.
 */
const aDiaCalendario = (valor: string | null | undefined): string => {
  const texto = (valor ?? '').trim();
  const conHora = /^(\d{4}-\d{2}-\d{2})[T ]/.exec(texto);
  if (conHora) return conHora[1];
  return texto;
};

/**
 * Convierte una fila del backend al modelo del frontend.
 *
 * El IGV no viene en el listado; se deriva del total y la base, que es la única
 * información disponible sin pedir el detalle de cada fila. Para la ficha se usa
 * `total_igv`, que sí viene exacto.
 */
export const aInvoice = (fila: ComprobanteBackend): Invoice => {
  const total = numero(fila.monto_total);
  // Se deriva de la base con la tasa del 18 %: 1180 → 180.
  const igv = Math.round((total / 1.18) * 0.18 * 100) / 100;

  return {
    id: fila.id,
    serie: fila.serie,
    numero: fila.numero,
    correlativo: fila.correlativo,
    clienteRuc: fila.cliente_documento ?? '',
    clienteRazonSocial: fila.cliente_nombre ?? 'CLIENTE SIN NOMBRE',
    fechaEmision: aDiaCalendario(fila.fecha_emision),
    moneda: aMoneda(fila.moneda),
    subtotal: Math.round((total - igv) * 100) / 100,
    igv,
    total,
    cdrStatus: aCdrStatus(fila.estado),
    cdrCodigo: fila.cdr_codigo ?? undefined,
    // El tipo no está en el modelo del front: se añade en la forma extendida.
    tipoComprobante: fila.tipo_comprobante,
    estadoBackend: fila.estado,
    documentoAfectado: fila.referenced_series_correlative ?? fila.documento_afectado ?? undefined,
    reintentable: esReintentable(fila.estado),
  };
};

/** Convierte el detalle, que sí trae el IGV exacto y el CDR. */
export const aInvoiceDetalle = (fila: ComprobanteDetalleBackend): Invoice => {
  const base = aInvoice(fila);
  const igv = numero(fila.total_igv);

  return {
    ...base,
    tieneCdr: fila.cdr != null,
    lineasOrigen: fila.lineas_origen ?? [],
    historial: (fila.historial ?? []).map((evento) => ({ id: evento.id, fecha: evento.created_at, mensaje: evento.mensaje_error })),
    igv,
    subtotal: numero(fila.base_imponible),
    cdrMensaje: fila.cdr?.descripcion ?? undefined,
    cdrCodigo: fila.cdr?.codigo ?? base.cdrCodigo,
    // Rechazo sin CDR: el código y el motivo del fault son lo único que hay.
    ultimoErrorCodigo: fila.ultimo_error_codigo ?? undefined,
    ultimoErrorMensaje: fila.ultimo_error_mensaje ?? undefined,
    // SHA-256 del XML firmado que se envió; permite verificar la descarga.
    hashCpe: fila.hash_xml ?? undefined,
    // Forma de pago y cronograma reales, leídos del payload UBL enviado.
    formaPago: fila.forma_pago ?? null,
    cuotas: fila.cuotas ?? [],
    // Referencia de la nota al documento que modifica. El modal ya sabía
    // pintarla (`documentoAfectado` + `motivoNota`); lo que faltaba era que el
    // dato llegara hasta aquí.
    documentoAfectado: fila.referenced_series_correlative ?? undefined,
    motivoNota: fila.credit_debit_reason_code
      ? {
          codigo: fila.credit_debit_reason_code,
          // La columna guarda SOLO el código; la descripción vive en el
          // Catálogo 09. Sin resolverla aquí, la ficha pintaba "(06 - )" con el
          // hueco a la vista, que se lee como un dato roto. Si el código no está
          // en el catálogo se muestra el código y nada más: no se inventa.
          descripcion:
            MOTIVOS_NC.find((m) => m.codigo === fila.credit_debit_reason_code)
              ?.descripcion ??
            MOTIVOS_ND.find((m) => m.codigo === fila.credit_debit_reason_code)
              ?.descripcion ??
            '',
        }
      : undefined,
  };
};

/** Convierte la página completa. */
export const aPaginaInvoices = (
  pagina: PaginaBackend,
): {
  data: Invoice[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} => ({
  data: (pagina.data ?? []).map(aInvoice),
  total: numero(pagina.total),
  page: numero(pagina.page) || 1,
  pageSize: numero(pagina.page_size) || 20,
  totalPages: numero(pagina.total_pages) || 1,
});

/** Los estados del backend son los del enum de Prisma, no los del front. */
export type EstadoBackend =
  | 'PENDIENTE'
  | 'EN_COLA'
  | 'ENVIADO'
  | 'ACEPTADO'
  | 'OBSERVADO'
  | 'RECHAZADO'
  | 'ERROR_RED'
  | 'ANULADO';

/** Ítem del front tal como se envía al backend. */
export interface ItemPayload {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

/** Alta de comprobante: del modelo del front al DTO del backend. */
export const aCreateInvoiceDto = (datos: {
  serie: string;
  clienteRuc: string;
  clienteRazonSocial: string;
  moneda: Moneda;
  items: readonly ItemPayload[];
}): {
  serie: string;
  clienteRuc: string;
  clienteRazonSocial: string;
  moneda: Moneda;
  items: readonly ItemPayload[];
} => ({
  serie: datos.serie,
  // Los documentos se mandan sin puntos ni guiones: el backend valida módulo 11
  // y un "20-100-070-970" con separadores es un RUC inválido.
  clienteRuc: (datos.clienteRuc ?? '').replace(/\D/g, ''),
  clienteRazonSocial: (datos.clienteRazonSocial ?? '').trim(),
  moneda: datos.moneda,
  items: datos.items.map((item) => ({
    descripcion: item.descripcion.trim(),
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
  })),
});

/** Reexportado para que la grilla pueda tipar sus ítems. */
export type { Invoice, InvoiceItem };
