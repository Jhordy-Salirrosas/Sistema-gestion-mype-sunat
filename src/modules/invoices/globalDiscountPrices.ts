import { Prisma } from '../../generated/client/client';
import { esAfectacionGratuita, tributoDeAfectacion } from './sunatCatalogsQuery';
import type { LineaDetalle } from './xmlNodesHelper';
import type { DescuentoGlobal } from './application/services/descuentoGlobal';

/** Atribución informativa al precio: el allowance de cabecera sigue siendo la única deducción contable. */
export function repartirDescuento(monto: number, bases: readonly number[]): number[] {
  const total = bases.reduce((s, b) => s.plus(b), new Prisma.Decimal(0));
  if (total.isZero()) return bases.map(() => 0);
  const mayor = bases.indexOf(Math.max(...bases));
  const partes = bases.map(b => new Prisma.Decimal(monto).times(b).div(total).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP));
  const residuo = new Prisma.Decimal(monto).minus(partes.reduce((s, b) => s.plus(b), new Prisma.Decimal(0)));
  partes[mayor] = partes[mayor].plus(residuo);
  return partes.map(p => p.toNumber());
}

export function descuentosGlobalesPrecio(lineas: readonly LineaDetalle[], descuento?: DescuentoGlobal | null): number[] {
  if (!descuento) return lineas.map(() => 0);
  const bases = lineas.map(l => esAfectacionGratuita(l.afectacion) || (descuento.codigo === '02' && tributoDeAfectacion(l.afectacion) !== '1000') ? 0 : new Prisma.Decimal(l.totalLinea).minus(l.igvLinea).toNumber());
  const importes = repartirDescuento(descuento.monto, bases);
  // El 02 también reduce el IGV de cabecera; se atribuye ese mismo impuesto, sin recalcular los totales.
  const igvDisponible = lineas.filter(l => !esAfectacionGratuita(l.afectacion)).reduce((s, l) => s.plus(l.igvLinea), new Prisma.Decimal(0));
  const rebajaIgv = Prisma.Decimal.min(igvDisponible, new Prisma.Decimal(descuento.monto).times('0.18').toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)).toNumber();
  const impuestos = descuento.codigo === '02' ? repartirDescuento(rebajaIgv, bases) : bases.map(() => 0);
  return importes.map((m, i) => new Prisma.Decimal(m).plus(impuestos[i]).toNumber());
}
