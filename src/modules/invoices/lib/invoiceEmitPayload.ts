import { cantidadBolsasDe } from './invoiceBags';
/**
 * Traducción del borrador del modal al contrato de `POST /invoices/emitir`.
 *
 * POR QUÉ EXISTE
 *
 * El modal de emisión se abría, se rellenaba, se pulsaba "Emitir…" y **no se
 * enviaba nada**: `InvoicesListPage` le pasaba un `onEmitir` que solo cerraba el
 * diálogo y recargaba la grilla. El usuario creía haber emitido y el backend no
 * había recibido ninguna petición — comprobado con la pestaña de red abierta:
 * el único tráfico era el `GET /invoices?tipo=07` de la recarga.
 *
 * La página `/invoices/emision` sí emitía, pero con su propio payload escrito a
 * mano dentro del componente. Este módulo es la misma traducción, sacada a un
 * sitio puro para que las dos rutas manden exactamente lo mismo y para poder
 * probarla sin montar React.
 */
import type { AfectacionIgv } from './invoiceTaxes';
import type { AfectacionGrilla, EmitirComprobantePayload } from '../types/invoiceEmision.types';
import type { BorradorEmision } from './invoiceEmitDraft';
import { esTipoNota } from './invoiceEmitDraft';
import { validarCronograma } from './invoiceDetraccion';
import { calcularFlujo } from './invoiceFlujoPago';

/**
 * Traducción de la afectación de la grilla al código del Catálogo 07.
 *
 * La grilla trabaja con nombres legibles ('GRAVADA', 'EXONERADA'…) porque los
 * usa para liquidar línea a línea; el XML necesita el código numérico. Sin este
 * paso, elegir "Exonerada" en pantalla emitía un comprobante gravado.
 */
export const CODIGO_AFECTACION: Record<AfectacionIgv, AfectacionGrilla> = {
  GRAVADA: '10',
  EXONERADA: '20',
  INAFECTA: '30',
  GRATUITA: '11',
};

/** Series por tipo de comprobante (catálogo del SEE). */
export const SERIE_POR_TIPO: Record<string, string> = {
  '01': 'F001',
  '03': 'B001',
  '07': 'FC01',
  '08': 'FD01',
};

/** Redondeo a céntimos, para no colar flotantes en la regla 3319. */
const aCentimos = (monto: number): number =>
  Math.round((monto + Number.EPSILON) * 100) / 100;

/**
 * Arma el payload de emisión a partir del borrador del formulario.
 *
 * El backend liquida los impuestos, valida el stock y reserva el correlativo:
 * aquí solo se traduce la forma, no se calcula nada fiscal.
 */
export const borradorAPayloadEmision = (
  b: BorradorEmision,
): EmitirComprobantePayload => {
  const esNota = esTipoNota(b.tipo);

  const payload: EmitirComprobantePayload = {
    almacen: b.almacen ?? 'ALM-01',
    tipo_comprobante: b.tipo,
    serie: b.serie,
    customer_identity_type: b.clienteDoc.length === 11 ? '6' : '1',
    customer_identity_number: b.clienteDoc.replace(/\D/g, ''),
    customer_legal_name: b.clienteRazonSocial.trim(),
    fecha_emision: b.fecha,
    agente_retencion: !esNota && b.agenteRetencion,
    ...(b.correccionRetencion ? { correccion_retencion: true } : {}),
    forma_pago: b.formaPago,
    cuotas:
      b.formaPago === 'Credito'
        ? b.cuotas.map((c) => ({
            // Se redondea también al armar el payload: el editor ya guarda
            // céntimos, pero un importe restaurado o pegado puede traer ruido
            // y la regla 3319 no admite tolerancia.
            monto: aCentimos(c.monto),
            vencimiento: c.vencimiento,
          }))
        : undefined,
    descuento_global: b.descuentoGlobal ?? null,
    items: b.items.map((item) => ({
      descripcion: item.descripcion.trim(),
      codigo: item.codigo.trim() || undefined,
      unidad: item.unidad,
      cantidad: item.cantidad,
      valorUnitario: item.valorUnitario,
      precioUnitario: typeof item.precioUnitario === 'number' && Number.isFinite(item.precioUnitario)
        ? item.precioUnitario
        : item.afectacion === 'GRAVADA' ? Number((item.valorUnitario * 1.18).toFixed(10)) : item.valorUnitario,
      descuento: item.descuento ?? null,
      // La afectación es POR LÍNEA: una factura puede llevar un ítem gravado y
      // otro exonerado. Mandar siempre '10' hacía que elegir "Exonerada" no
      // llegara nunca al XML.
      afectacion: (item.codigoAfectacion ?? CODIGO_AFECTACION[item.afectacion]) as AfectacionGrilla,
      // Igual con la detracción: "eso lo manda el producto, no la factura".
      codigoDetraccion: item.codigoDetraccion || undefined,
      // Cantidad e impuesto pertenecen a la misma línea registrada.
      cantidadBolsas: cantidadBolsasDe(item) > 0 ? cantidadBolsasDe(item) : undefined,
      icbper: item.icbper > 0 ? item.icbper : undefined,
    })),
  };

  if (calcularFlujo(b).detraccion > 0 && b.medioPagoDetraccion) {
    payload.medio_pago_detraccion = b.medioPagoDetraccion;
  }

  if (esNota) {
    payload.documento_afectado = b.documentoAfectado;
    payload.codigo_motivo_nota = b.motivoCodigo;
    payload.descripcion_motivo_nota = b.motivoDescripcion;
  }

  return payload;
};

/**
 * Comprueba que el cronograma cuadre antes de mandar.
 *
 * Devuelve el mensaje del primer problema, o `null` si se puede emitir. Una
 * venta al crédito sin cronograma válido no se manda: el backend la rechazaría
 * y el usuario habría esperado una vuelta completa.
 */
export const problemaDeCronograma = (b: BorradorEmision): string | null => {
  if (b.formaPago !== 'Credito') return null;

  const revision = validarCronograma(
    b.cuotas,
    calcularFlujo(b).neto,
    b.fecha,
  );
  if (revision.cuadra && revision.errores.length === 0) return null;

  return (
    revision.errores[0] ??
    `El cronograma no cuadra: las cuotas suman ${revision.suma.toFixed(2)} y el neto pendiente es ${revision.netoPendiente.toFixed(2)}.`
  );
};
