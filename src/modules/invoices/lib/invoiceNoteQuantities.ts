import Decimal from 'decimal.js';
import type { ItemBorrador } from './invoiceItems';
export interface CantidadNota { codigo: string; original: number; pendiente: number }

/** El saldo es informativo; el guard transaccional del servidor decide al crear. */
export function limitesNota(items: readonly ItemBorrador[], cantidades: readonly CantidadNota[] | undefined, motivo: string, motivosTotales?: readonly string[]) {
  if (!cantidades) return { maximos: undefined, errores: ['No se pudieron consultar las cantidades pendientes del origen.'] };
  if (!motivosTotales) return { maximos: undefined, errores: ['No se pudieron consultar los motivos totales de la nota.'] };
  const total = motivosTotales.includes(motivo);
  const usarPendiente = total || ['01', '06', '07'].includes(motivo);
  const maximos = items.map((item, i) => {
    const sku = item.codigo.trim();
    const saldo = cantidades.find(c => c.codigo === sku);
    const disponible = new Decimal(saldo ? (usarPendiente ? saldo.pendiente : saldo.original) : 0);
    const otras = items.reduce((s, l, j) => j !== i && l.codigo.trim() === sku ? s.plus(l.cantidad) : s, new Decimal(0));
    return Decimal.max(0, disponible.minus(otras)).toNumber();
  });
  const errores = items.flatMap((item, i) => item.cantidad > maximos[i] ? [`La línea ${i + 1} supera las unidades disponibles del origen para ${item.codigo || 'el producto'} (máximo ${maximos[i]}).`] : []);
  if (total) {
    const solicitadas = new Map<string, Decimal>();
    for (const item of items) {
      const sku = item.codigo.trim();
      solicitadas.set(sku, (solicitadas.get(sku) ?? new Decimal(0)).plus(item.cantidad));
    }
    for (const saldo of cantidades) {
      const pedido = solicitadas.get(saldo.codigo) ?? new Decimal(0);
      if (pedido.lessThan(saldo.pendiente)) errores.push(`El motivo total exige todas las unidades pendientes de ${saldo.codigo}: pendientes ${saldo.pendiente}, indicadas ${pedido.toString()}.`);
    }
  }
  return { maximos, errores };
}

/** Precarga determinista por orden del origen; no cambia precios ni muta las líneas recibidas. */
export function precargarCantidadesNota(items: readonly ItemBorrador[], cantidades: readonly CantidadNota[], motivo: string): ItemBorrador[] {
  const devuelve = ['01', '06', '07'].includes(motivo);
  const pools = new Map(cantidades.map(c => [c.codigo, new Decimal(devuelve ? c.pendiente : c.original)]));
  const prorratear = (monto: number, cantidad: number, original: number) => new Decimal(monto).times(cantidad).div(original).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  return items.flatMap(item => {
    const sku = item.codigo.trim();
    const pool = pools.get(sku) ?? new Decimal(0);
    const cantidad = Decimal.min(pool, item.cantidad).toNumber();
    if (cantidad <= 0) return [];
    pools.set(sku, pool.minus(cantidad));
    if (cantidad === item.cantidad) return [item];
    const monto = item.descuento ? prorratear(item.descuento.monto, cantidad, item.cantidad) : 0;
    return [{ ...item, cantidad,
      descuento: item.descuento && monto > 0 ? { ...item.descuento, monto } : null,
      icbper: prorratear(item.icbper, cantidad, item.cantidad),
    }];
  });
}
