import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../../../generated/client/client';

export interface CantidadOrigen { item_code: string | null; quantity: Prisma.Decimal | number }
export const devuelveUnidades = (motivo: string | null | undefined): boolean => ['01', '06', '07'].includes(motivo ?? '');

/** Saldo físico independiente del monetario, con la misma precisión de la persistencia. */
export function cantidadesPendientes(originales: readonly CantidadOrigen[], anteriores: readonly CantidadOrigen[]): Map<string, Prisma.Decimal> {
  const pendientes = new Map<string, Prisma.Decimal>();
  for (const l of originales) if (l.item_code) {
    const sku = l.item_code.trim();
    pendientes.set(sku, (pendientes.get(sku) ?? new Prisma.Decimal(0)).plus(l.quantity));
  }
  for (const l of anteriores) if (l.item_code) {
    const sku = l.item_code.trim();
    pendientes.set(sku, (pendientes.get(sku) ?? new Prisma.Decimal(0)).minus(l.quantity));
  }
  return pendientes;
}

/** El llamador mantiene el lock del origen hasta persistir la nota. */
export function validarCantidadesNota(nuevas: { codigo?: string; cantidad: number }[], originales: CantidadOrigen[], anteriores: CantidadOrigen[], devolucionTotal = false): void {
  const vendidos = new Set(originales.filter(l => l.item_code).map(l => l.item_code!.trim()));
  const pendientes = cantidadesPendientes(originales, anteriores);
  for (const l of nuevas) {
    const sku = l.codigo!.trim();
    if (!vendidos.has(sku)) throw new BadRequestException('La nota contiene un producto ajeno al comprobante origen');
    pendientes.set(sku, pendientes.get(sku)!.minus(l.cantidad));
  }
  for (const [sku, cantidad] of pendientes) {
    if (cantidad.isNegative()) throw new ConflictException(`NOTA_EXCEDE_CANTIDAD: ${sku}`);
    if (devolucionTotal && !cantidad.isZero()) throw new BadRequestException(`NOTA_DEVOLUCION_TOTAL_INCOMPLETA: debe devolver todas las unidades pendientes de ${sku}`);
  }
}
