import { calcularItem, totalizarItems, type ItemBorrador } from './invoiceItems';
import { round2 } from './invoiceTaxes';

export interface DescuentoGlobal { codigo: '02' | '03'; monto: number }

/** Calcula el descuento global sin inventar un monto cuando no existe. */
export function liquidarDescuentoGlobal(items: readonly ItemBorrador[], descuento: DescuentoGlobal | null | undefined) {
  const totales = totalizarItems(items);
  const gravado = round2(items.filter((i) => i.afectacion === 'GRAVADA').reduce((s, i) => s + calcularItem(i).base, 0));
  if (!descuento) return { ...totales, gravado, error: null as string | null };
  const base = descuento.codigo === '02' ? gravado : totales.total;
  if (!Number.isFinite(descuento.monto) || descuento.monto <= 0 || round2(descuento.monto) !== descuento.monto || descuento.monto > base) {
    return { ...totales, gravado, error: 'El descuento global debe ser positivo y no exceder su base.' };
  }
  const rebajaIgv = descuento.codigo === '02' ? Math.min(totales.igv, round2(descuento.monto * 0.18)) : 0;
  return {
    ...totales,
    base: round2(totales.base - (descuento.codigo === '02' ? descuento.monto : 0)),
    gravado: round2(gravado - (descuento.codigo === '02' ? descuento.monto : 0)),
    igv: round2(totales.igv - rebajaIgv),
    total: round2(totales.total - descuento.monto - rebajaIgv),
    error: null,
  };
}
