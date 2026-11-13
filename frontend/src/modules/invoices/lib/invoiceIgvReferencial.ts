import type { ItemBorrador } from './invoiceItems';
import { IGV_RATE, multiplyMoney, round2 } from './invoiceTaxes';

/** Tributo referencial de gratuitas gravadas; nunca integra el importe a pagar. */
export function igvReferencialGratuito(items: readonly ItemBorrador[]): number {
  return round2(items.reduce((total, item) => {
    if (item.afectacion !== 'GRATUITA' || !/^1[1-7]$/.test(item.codigoAfectacion ?? '')) return total;
    return total + multiplyMoney(multiplyMoney(item.cantidad, item.valorUnitario), IGV_RATE);
  }, 0));
}
