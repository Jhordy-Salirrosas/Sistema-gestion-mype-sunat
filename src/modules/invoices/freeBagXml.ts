import { esDocumentoIntegramenteGratuito } from './freeInvoicePolicy';
import { lineaBolsaIcBper } from './ublIcbperLine';
import type { InvoicePayload } from './invoicePayload';

/** Expansión exclusiva del XML íntegramente gratuito: no crea productos ni modifica el payload guardado. */
export function separarBolsasGratuitas(payload: InvoicePayload): InvoicePayload {
  if (payload.tipoComprobante !== '01') return payload;
  const lineas = payload.lineas ?? (payload.linea ? [payload.linea] : []);
  if (!esDocumentoIntegramenteGratuito(payload.tipoComprobante!, lineas)) return payload;
  const impuesto = lineas.reduce((s, l) => s + (l.icbperLinea ?? 0), 0);
  if (!(impuesto > 0)) return payload;
  return { ...payload, linea: undefined, lineas: [
    ...lineas.map(l => ({ ...l, icbperLinea: undefined, cantidadBolsas: undefined })),
    lineaBolsaIcBper(lineas.length + 1, { cantidad: Math.round(impuesto * 2) })!,
  ] };
}
