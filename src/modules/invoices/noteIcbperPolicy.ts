import type { InvoicePayload } from './invoicePayload';
import { redondearMoneda } from './money';

export const esNotaDescuento = (tipo: string, motivo: string | undefined): boolean => tipo === '07' && (motivo === '04' || motivo === '09');
/** El importe heredado no acredita devolución; la cantidad debe estar en la propia nota. */
export const sinBolsasDevueltas = (cantidad: number | null | undefined): boolean => !(cantidad != null && cantidad > 0);

/** Defensa del XML legado, sin mutar el payload ni reinterpretar la anulación 01. */
export function aplicarIcbperNota(payload: InvoicePayload): InvoicePayload {
  if (!esNotaDescuento(payload.tipoComprobante, payload.codigoMotivoNota)) return payload;
  const lineas = payload.lineas ?? (payload.linea ? [payload.linea] : []);
  const original = lineas.reduce((s, l) => s + (l.icbperLinea ?? 0), 0);
  const partidas = lineas.map(l => sinBolsasDevueltas(l.cantidadBolsas) ? { ...l, icbperLinea: undefined } : l);
  const vigente = partidas.reduce((s, l) => s + (l.icbperLinea ?? 0), 0);
  const retirado = redondearMoneda((original || (payload.bolsasIcBper ?? 0) * .5) - vigente);
  return { ...payload, linea: undefined, lineas: partidas, bolsasIcBper: undefined,
    montoTotal: payload.montoTotalIncluyeIcbper ? redondearMoneda(payload.montoTotal - retirado) : payload.montoTotal };
}
