import Decimal from 'decimal.js';
import type { ItemBorrador } from './invoiceItems';
export interface CantidadNota { codigo: string; original: number; pendiente: number }

/** El saldo es informativo; el guard transaccional del servidor decide al crear. */
export function limitesNota(items: readonly ItemBorrador[], cantidades: readonly CantidadNota[] | undefined, motivo: string) {
  if (!cantidades) return { maximos: undefined, errores: ['No se pudieron consultar las cantidades pendientes del origen.'] };
  const devuelve = ['01', '06', '07'].includes(motivo);
  const maximos = items.map((item, i) => {
    const sku = item.codigo.trim();
    const saldo = cantidades.find(c => c.codigo === sku);
    const disponible = new Decimal(saldo ? (devuelve ? saldo.pendiente : saldo.original) : 0);
    const otras = items.reduce((s, l, j) => j !== i && l.codigo.trim() === sku ? s.plus(l.cantidad) : s, new Decimal(0));
    return Decimal.max(0, disponible.minus(otras)).toNumber();
  });
  const errores = items.flatMap((item, i) => item.cantidad > maximos[i] ? [`La línea ${i + 1} supera las unidades disponibles del origen para ${item.codigo || 'el producto'} (máximo ${maximos[i]}).`] : []);
  return { maximos, errores };
}
