import { calcularItem, totalizarItems, type ItemBorrador } from './invoiceItems';
import { buscarDetraccion } from './invoiceDetraccion';
import { calcularDetraccionPorLineas } from './invoiceDetraccionLinea';
import { liquidarDescuentoGlobal, type DescuentoGlobal } from './invoiceDescuentoGlobal';
import { round2 } from './invoiceTaxes';

/** Replica la asignación proporcional del descuento global a las líneas sujetas. */
export function detraccionConDescuento(items: readonly ItemBorrador[], descuento: DescuentoGlobal | null) {
  const final = liquidarDescuentoGlobal(items, descuento);
  const resultado = calcularDetraccionPorLineas(items.map((i) => ({ base: calcularItem(i).total, codigoDetraccion: i.codigoDetraccion })), final.total);
  if (!resultado.aplica || !descuento || final.error) return resultado;
  const original = totalizarItems(items).total;
  const gravado = items.filter((i) => i.afectacion === 'GRAVADA').reduce((s, i) => s + calcularItem(i).base, 0);
  const gravadoSujeto = items.filter((i) => i.afectacion === 'GRAVADA' && i.codigoDetraccion).reduce((s, i) => s + calcularItem(i).base, 0);
  const rebaja = descuento.codigo === '02' && gravado > 0
    ? round2(descuento.monto * gravadoSujeto / gravado * 1.18)
    : descuento.codigo === '03' && original > 0
      ? round2(descuento.monto * resultado.baseSujeta / original)
      : 0;
  const baseSujeta = round2(resultado.baseSujeta - rebaja);
  const tasa = buscarDetraccion(resultado.codigos[0])?.porcentaje ?? 0;
  return { ...resultado, aplica: baseSujeta > 0, baseSujeta, monto: round2(baseSujeta * tasa) };
}
