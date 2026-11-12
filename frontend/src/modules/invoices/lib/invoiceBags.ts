import type { ItemBorrador } from './invoiceItems';
import { ICBPER_POR_UNIDAD, multiplyMoney } from './invoiceTaxes';
/** Los borradores históricos solo tenían el impuesto. No se altera su importe. */
export const cantidadBolsasDe = (item: ItemBorrador): number => item.cantidadBolsas ?? item.icbper / ICBPER_POR_UNIDAD;
export function errorBolsas(item: ItemBorrador): string | undefined {
  const cantidad = cantidadBolsasDe(item);
  if (!Number.isSafeInteger(cantidad) || cantidad < 0) return 'La cantidad de bolsas debe ser entera y no negativa.';
  if (!Number.isFinite(item.icbper) || item.icbper !== multiplyMoney(cantidad, ICBPER_POR_UNIDAD)) return 'El ICBPER no coincide con la cantidad de bolsas.';
}
export const impuestoBolsas = (cantidad: number): number => multiplyMoney(cantidad, ICBPER_POR_UNIDAD);

export const BOLETA_GRATUITA_BOLSAS = 'Una boleta íntegramente gratuita no admite bolsas plásticas. Retire las bolsas o emita una factura.';
export const bolsasBloqueadasEnBoleta = (tipo: string, items: readonly ItemBorrador[]): boolean =>
  tipo === '03' && items.length > 0 && items.every(item => item.afectacion === 'GRATUITA');
