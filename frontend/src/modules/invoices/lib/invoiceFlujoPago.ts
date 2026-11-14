import type { BorradorEmision } from './invoiceEmitDraft';
import { esTipoNota } from './invoiceEmitDraft';
import { liquidarDescuentoGlobal } from './invoiceDescuentoGlobal';
import { detraccionConDescuento } from './invoiceDetraccionGlobal';
import { calcularRetencion } from './invoiceRetentions';
import { round2 } from './invoiceTaxes';

/** Neto de pago con los importes que viajan en las líneas del comprobante. */
export const calcularFlujo = (b: BorradorEmision) => {
  const totales = liquidarDescuentoGlobal(b.items, b.descuentoGlobal);
  const importeTotal = totales.total;
  const esNota = esTipoNota(b.tipo);
  const detraccion = esNota ? 0 : detraccionConDescuento(b.items, b.descuentoGlobal ?? null).monto;
  const retencion = calcularRetencion(importeTotal, !esNota && b.agenteRetencion, 1, detraccion, totales.gravado);
  return { importeTotal, detraccion, neto: round2(importeTotal - detraccion - retencion) };
};
