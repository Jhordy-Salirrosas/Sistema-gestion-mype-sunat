import { BadRequestException } from '@nestjs/common';

/** Descuentos globales operativos del Catálogo 53; 04 requiere anticipos. */
export interface DescuentoGlobal {
  codigo: '02' | '03';
  monto: number;
}

export interface BasesDescuentoGlobal {
  gravado: number;
  igv: number;
  exonerado: number;
  inafecto: number;
  exportado: number;
  icbper: number;
}

const centimos = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** El 02 reduce base IGV; el 03 reduce solo el importe a pagar. */
export function aplicarDescuentoGlobal<T extends BasesDescuentoGlobal>(
  bases: T,
  descuento: DescuentoGlobal | null | undefined,
  descuentoLineaNoAfecto = 0,
): { bases: T; otrosDescuentos: number; total: number; baseDescuento: number } {
  const bruto = centimos(bases.gravado + bases.igv + bases.exonerado + bases.inafecto + bases.exportado + bases.icbper - descuentoLineaNoAfecto);
  if (!descuento) return { bases, otrosDescuentos: descuentoLineaNoAfecto, total: bruto, baseDescuento: 0 };
  const { codigo, monto } = descuento;
  if (!['02', '03'].includes(codigo) || !Number.isFinite(monto) || monto <= 0 || centimos(monto) !== monto) {
    throw new BadRequestException('El descuento global debe ser 02 o 03 y tener un monto positivo con dos decimales.');
  }
  const baseDescuento = codigo === '02' ? bases.gravado : bruto;
  if (monto > baseDescuento) throw new BadRequestException('El descuento global excede su base.');
  if (codigo === '03') return { bases, otrosDescuentos: centimos(descuentoLineaNoAfecto + monto), total: centimos(bruto - monto), baseDescuento };
  const nuevas = { ...bases, gravado: centimos(bases.gravado - monto), igv: Math.max(0, centimos(bases.igv - centimos(monto * 0.18))) };
  return { bases: nuevas, otrosDescuentos: descuentoLineaNoAfecto, total: centimos(bruto - monto - (bases.igv - nuevas.igv)), baseDescuento };
}
