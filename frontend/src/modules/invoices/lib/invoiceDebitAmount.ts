import Decimal from 'decimal.js';
import type { BorradorEmision } from './invoiceEmitDraft';
import { calcularFlujo } from './invoiceFlujoPago';
import { cantidadBolsasDe } from './invoiceBags';
/** Ajuste monetario exclusivo de ND: no cambia código, unidad, cantidad,
 * afectación ni bolsas. El precio del ajuste se calcula, nunca se digita.
 */
export function applyDebitAmount(b: BorradorEmision, amount: number, available: number): BorradorEmision {
  if (b.tipo !== '08' || !Number.isFinite(amount) || amount <= 0 || new Decimal(amount).decimalPlaces() > 2 || amount > available) throw Error('Indique un importe positivo de hasta dos decimales que no supere el saldo.');
  const fixed = b.items.reduce((sum, item) => sum + cantidadBolsasDe(item) * 0.5, 0);
  const total = calcularFlujo(b).importeTotal;
  if (amount <= fixed || total <= fixed) throw Error('El importe debe cubrir los tributos fijos de las líneas.');
  const factor = new Decimal(amount).minus(fixed).div(new Decimal(total).minus(fixed));
  const scaled = (value: number, places = 6) => new Decimal(value).times(factor).toDecimalPlaces(places).toNumber();
  const next = { ...b, items: b.items.map(item => item.afectacion === 'GRATUITA' ? item : ({ ...item, valorUnitario: scaled(item.valorUnitario), precioUnitario: scaled(item.precioUnitario ?? item.valorUnitario * (item.afectacion === 'GRAVADA' ? 1.18 : 1)), descuento: item.descuento ? { ...item.descuento, monto: scaled(item.descuento.monto, 2) } : null })), descuentoGlobal: b.descuentoGlobal ? { ...b.descuentoGlobal, monto: scaled(b.descuentoGlobal.monto, 2) } : null };
  const last = next.items.map((item, index) => item.afectacion !== 'GRATUITA' && item.cantidad > 0 ? index : -1).reduce((max, index) => Math.max(max, index), -1);
  if (last < 0) throw Error('Seleccione una línea onerosa del comprobante afectado.');
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = calcularFlujo(next).importeTotal;
    if (Math.round(current * 100) === Math.round(amount * 100)) return next;
    const item = next.items[last]; const tax = item.afectacion === 'GRAVADA' ? 1.18 : 1;
    const correction = new Decimal(amount).minus(current).div(item.cantidad).div(tax);
    const value = new Decimal(item.valorUnitario).plus(correction).toDecimalPlaces(6).toNumber();
    if (!(value > 0)) break;
    next.items[last] = { ...item, valorUnitario: value, precioUnitario: new Decimal(value).times(tax).toDecimalPlaces(6).toNumber() };
  }
  throw Error('No se pudo distribuir exactamente el importe entre las líneas; revise el detalle.');
}
