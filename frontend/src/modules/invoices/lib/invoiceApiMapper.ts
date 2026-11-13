import type { ResultadoPresentacion } from './invoiceResultPresentation';
/**
 * Adaptador entre el DTO del backend (TA-29) y el modelo que pinta la grilla.
 *
 * La grilla (`ComprobanteDemo`) se diseñó sobre datos semilla y expone más
 * campos de los que el backend guarda hoy: detracción, retención, cuotas y
 * líneas. Se rellenan con valores neutros y documentados en vez de inventar
 * montos; el total y el IGV sí vienen del backend cuando están disponibles.
 */
import type { EstadoCdrDemo, ComprobanteDemo, TipoComprobante } from '../data/invoiceDemoSchema';
import { descripcionCdr } from '../data/invoiceDemoHelpers';
import type { CreateInvoicePayload, Invoice, InvoiceListado } from '../types/invoice.types';

/** Redondeo a dos decimales, igual que el resto del módulo. */
const round2 = (valor: number): number => Math.round(valor * 100) / 100;

/**
 * Estados del backend → estados que entiende el badge.
 *
 * Los estados intermedios del outbox (PENDIENTE, EN_COLA, PROCESANDO,
 * ENVIADO, ERROR_RED) se muestran como "en cola": el CDR todavía no llegó.
 */
const ESTADOS: Record<string, EstadoCdrDemo> = {
  ACEPTADO: 'ACEPTADO',
  OBSERVADO: 'OBSERVADO',
  RECHAZADO: 'RECHAZADO',
  ERROR_RED: 'SIN_CONFIRMAR',
  ANULADO: 'RECHAZADO',
};

/** Tipos UBL que la grilla distingue; el resto se trata como factura. */
const TIPOS: Record<string, TipoComprobante> = {
  '03': '03',
  '07': '07',
  '08': '08',
};

/**
 * Fecha del comprobante en la zona del equipo.
 *
 * `fecha_emision` llega en ISO UTC: cortar el string daría el día siguiente
 * para una emisión después de las 19:00 en Lima.
 */
function fechaLocal(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso.slice(0, 10);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Convierte una fila del backend al modelo de la grilla.
 *
 * Acepta las DOS formas que circulan por el front: el `InvoiceListado` crudo
 * del listado y el `Invoice` ya normalizado por `invoiceMapper` (que es lo que
 * devuelve `invoicesApi.getInvoices`). Se unificaron aquí para no mantener dos
 * mapeos del mismo comprobante, que es cómo se desincronizan las columnas.
 */
/** Datos del comprobante que la grilla necesita, ya sin depender del contrato. */
interface FilaComprobante {
  transporteAcreditado?: boolean;
  montoDetraccion?: number | null;
  montoRetencion?: number | null;
  resultadoPresentacion?: ResultadoPresentacion;
  id: string;
  serie: string;
  correlativo: string;
  tipoComprobante: string;
  fechaEmision: string;
  clienteDocumento: string;
  clienteNombre: string;
  moneda: string;
  base: number;
  igv: number;
  total: number;
  estado: string;
  cdrCodigo?: string;
  cdrMensaje?: string;
  documentoAfectado?: string;
  comprobanteOrigen?: ComprobanteDemo['comprobanteOrigen'];
  motivoNota?: { codigo: string; descripcion: string };
  formaPago: 'Contado' | 'Credito' | null;
  cuotas: readonly { numero: string; monto: number; vencimiento: string }[];
  hashCpe: string;
}

/** Distingue la fila ya normalizada por `invoiceMapper` de la cruda. */
const esInvoiceNormalizado = (item: Invoice | InvoiceListado): item is Invoice =>
  'estadoBackend' in item;

const desdeNormalizado = (item: Invoice): FilaComprobante => ({
  montoDetraccion: item.montoDetraccion,
  montoRetencion: item.montoRetencion,
  transporteAcreditado: item.transporteAcreditado,
  resultadoPresentacion: item.resultadoPresentacion,
  id: item.id,
  serie: item.serie,
  correlativo: String(item.correlativo),
  tipoComprobante: item.tipoComprobante ?? '01',
  fechaEmision: item.fechaEmision,
  clienteDocumento: item.clienteRuc,
  clienteNombre: item.clienteRazonSocial,
  moneda: item.moneda,
  base: item.subtotal ?? round2(item.total / 1.18),
  igv: item.igv,
  total: item.total,
  estado: item.estadoBackend ?? '',
  cdrCodigo: item.cdrCodigo,
  cdrMensaje: item.cdrMensaje,
  documentoAfectado: item.documentoAfectado,
  comprobanteOrigen: item.comprobanteOrigen ?? null,
  motivoNota: item.motivoNota,
  formaPago: item.formaPago ?? null,
  cuotas: item.cuotas ?? [],
  hashCpe: item.hashCpe ?? '',
});

const desdeCrudo = (item: InvoiceListado): FilaComprobante => {
  const total = Number(item.monto_total) || 0;
  return {
    montoDetraccion: item.monto_detraccion,
    montoRetencion: item.monto_retencion,
    transporteAcreditado: item.transporte_acreditado === true,
    resultadoPresentacion: item.resultado_presentacion,
    id: item.id,
    serie: item.serie,
    correlativo: String(item.correlativo),
    tipoComprobante: item.tipo_comprobante,
    fechaEmision: fechaLocal(item.fecha_emision),
    clienteDocumento: item.cliente_documento ?? '',
    clienteNombre: item.cliente_nombre ?? '',
    moneda: item.moneda,
    base: item.base_imponible ?? round2(total / 1.18),
    igv: item.total_igv ?? round2(total - (item.base_imponible ?? round2(total / 1.18))),
    total,
    estado: item.estado,
    cdrCodigo: item.cdr_codigo ?? undefined,
    cdrMensaje: item.cdr_descripcion ?? undefined,
    documentoAfectado: item.documento_afectado ?? undefined,
    comprobanteOrigen: item.comprobante_origen
      ? {
          id: item.comprobante_origen.id ?? null,
          tipoComprobante: item.comprobante_origen.tipo_comprobante ?? null,
          serie: item.comprobante_origen.serie ?? null,
          correlativo: item.comprobante_origen.correlativo ?? null,
          numero: item.comprobante_origen.numero,
          clienteDocumento: item.comprobante_origen.cliente_documento ?? null,
          clienteNombre: item.comprobante_origen.cliente_nombre ?? null,
          montoTotal: item.comprobante_origen.monto_total ?? null,
          moneda: item.comprobante_origen.moneda ?? null,
        }
      : null,
    formaPago: item.forma_pago ?? null,
    cuotas: item.cuotas ?? [],
    hashCpe: item.hash_cpe ?? '',
  };
};

/**
 * Convierte una fila del backend al modelo de la grilla.
 *
 * Acepta las DOS formas que circulan por el front: el `InvoiceListado` crudo
 * del listado y el `Invoice` ya normalizado por `invoiceMapper` (que es lo que
 * devuelve `invoicesApi.getInvoices`). Se unificaron aquí para no mantener dos
 * mapeos del mismo comprobante, que es cómo se desincronizan las columnas.
 */
export function aComprobanteDemo(item: InvoiceListado | Invoice): ComprobanteDemo {
  const fila = esInvoiceNormalizado(item) ? desdeNormalizado(item) : desdeCrudo(item);
  const documento = fila.clienteDocumento;
  const correlativoNum = Number(fila.correlativo) || 0;

  return {
    importesBandeja: esInvoiceNormalizado(item) ? item.importesBandeja : undefined,
    tieneCdr: esInvoiceNormalizado(item) ? item.tieneCdr : undefined,
    transporteAcreditado: fila.transporteAcreditado === true,
    resultadoPresentacion: fila.resultadoPresentacion,
    id: fila.id,
    numero: `${fila.serie}-${String(correlativoNum).padStart(8, '0')}`,
    tipo: TIPOS[fila.tipoComprobante] ?? '01',
    serie: fila.serie,
    correlativo: correlativoNum,
    clienteRuc: documento,
    clienteTipoDoc: documento.length === 11 ? '6' : '1',
    clienteRazonSocial: fila.clienteNombre || 'Sin nombre registrado',
    fechaEmision: fila.fechaEmision,
    moneda: fila.moneda === 'USD' ? 'USD' : 'PEN',
    baseImponible: esInvoiceNormalizado(item) && item.importesBandeja?.verificado ? item.importesBandeja.base : fila.base,
    igv: esInvoiceNormalizado(item) && item.importesBandeja?.verificado ? item.importesBandeja.igv : fila.igv,
    // Cero solo representa ausencia de importe visible en la grilla; el DTO conserva null.
    detraccion: fila.montoDetraccion ?? 0,
    retencion: fila.montoRetencion ?? 0,
    totalNeto: esInvoiceNormalizado(item) && item.importesBandeja?.verificado ? item.importesBandeja.total : fila.total,
    estado: ESTADOS[fila.estado] ?? 'EN_COLA',
    estadoBackend: fila.estado,
    cdrCodigo: fila.cdrCodigo,
    documentoAfectado: fila.documentoAfectado,
    comprobanteOrigen: fila.comprobanteOrigen ?? null,
    motivoNota: fila.motivoNota,
    tipoOperacion: '0101',
    formaPago: fila.formaPago,
    cuotas: fila.cuotas,
    cdrDescripcion:
      fila.cdrMensaje ??
      (fila.cdrCodigo
        ? descripcionCdr(fila.cdrCodigo)
        : 'Sin CDR: el comprobante aún no tiene respuesta de SUNAT'),
    hashCpe: fila.hashCpe,
    items: [],
  };
}

/** Datos del emisor que viajan al comprobante (salen de la sesión). */
export interface EmisorDatos {
  ruc: string;
  razonSocial: string;
}

/**
 * Convierte el comprobante de la grilla en el payload de alta del backend.
 *
 * El contrato `payload_ubl` es el que consume el generador UBL 2.1
 * (`InvoicePayload`), no una copia libre: si cambia el generador, este mapeo
 * debe cambiar con él.
 */
export function aPayloadCreacion(
  comprobante: ComprobanteDemo,
  emisor: EmisorDatos,
): CreateInvoicePayload {
  const lineas = comprobante.items.map((item, index) => {
    const neto = round2(item.valorUnitario * item.cantidad);
    const igvLinea = round2(neto * 0.18);

    return {
      id: index + 1,
      descripcion: item.descripcion,
      codigo: item.codigo || undefined,
      unidad: item.unidad,
      cantidad: item.cantidad,
      valorUnitario: item.valorUnitario,
      precioUnitario: round2(item.valorUnitario * 1.18),
      afectacion: '10',
      totalLinea: round2(neto + igvLinea),
      igvLinea,
    };
  });

  const total = round2(comprobante.baseImponible + comprobante.igv);

  return {
    ruc_emisor: emisor.ruc,
    serie: comprobante.serie,
    correlativo: comprobante.correlativo,
    tipo_comprobante: comprobante.tipo,
    monto_total: total,
    fecha_emision: comprobante.fechaEmision,
    payload_ubl: {
      rucEmisor: emisor.ruc,
      razonSocialEmisor: emisor.razonSocial,
      tipoComprobante: comprobante.tipo,
      serie: comprobante.serie,
      numero: comprobante.correlativo,
      fechaEmision: comprobante.fechaEmision,
      tipoMoneda: comprobante.moneda,
      tipoOperacion: comprobante.tipoOperacion,
      formaPago: comprobante.formaPago,
      cliente: {
        tipoDocumento: comprobante.clienteTipoDoc,
        numeroDocumento: comprobante.clienteRuc,
        razonSocial: comprobante.clienteRazonSocial,
      },
      lineas,
      montoGravado: comprobante.baseImponible,
      montoIgv: comprobante.igv,
      montoTotal: total,
      ...(comprobante.documentoAfectado
        ? { documentoAfectado: comprobante.documentoAfectado }
        : {}),
      ...(comprobante.detraccion > 0
        ? { montoDetraccion: comprobante.detraccion }
        : {}),
      ...(comprobante.retencion > 0
        ? { montoRetencion: comprobante.retencion }
        : {}),
    },
  };
}
