import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../../generated/client/client';
import type { EmitirComprobanteDto } from '../dto/emitirComprobanteDto';

/** Reserva derivada: invoice + items son durables en el mismo commit de creación. */
export async function validarReservaVenta(tx: Prisma.TransactionClient, dto: EmitirComprobanteDto, companyId: string): Promise<void> {
  if (!['01', '03'].includes(dto.tipo_comprobante)) return;
  const productos = await tx.inventoryProduct.findMany({ where: { company_id: companyId, sku: { in: dto.items.map(l => l.codigo!) }, is_inventory: true },
    select: { id: true, sku: true, is_inventory: true } });
  const fisicos = productos.filter(p => p.is_inventory === true);
  if (!fisicos.length) return;
  const almacen = await tx.inventoryWarehouse.findFirstOrThrow({ where: { company_id: companyId, warehouse_code: dto.almacen } });
  // También lo toma el movimiento físico: no hay ventana entre reserva y descarga.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inventory:${companyId}:${almacen.id}`}, 0))`;
  await tx.$executeRaw`SELECT id FROM inventory_balances WHERE company_id = ${companyId} AND warehouse_id = ${almacen.id} AND product_id = ANY(${fisicos.map(p => p.id)}::text[]) ORDER BY product_id FOR UPDATE`;
  const saldos = await tx.inventoryBalance.findMany({ where: { company_id: companyId, warehouse_id: almacen.id, product_id: { in: fisicos.map(p => p.id) } } });
  const documentos = await tx.invoice.findMany({ where: { company_id: companyId, tipo_comprobante: { in: ['01', '03'] }, estado: { notIn: ['RECHAZADO', 'ANULADO'] } }, select: { payload_ubl: true, serie: true, correlativo: true, items: { select: { item_code: true, quantity: true } } } });
  const movimientos = await tx.inventoryMovement.findMany({ where: { company_id: companyId, warehouse_id: almacen.id, operation_type_code: '01', product_id: { in: fisicos.map(p => p.id) } },
    select: { product_id: true, source_reference_id: true, quantity: true } });
  for (const p of fisicos) {
    let reservado = new Prisma.Decimal(0);
    for (const d of documentos) {
      if (((d.payload_ubl as unknown as { almacen?: string })?.almacen ?? 'ALM-01') !== dto.almacen) continue;
      const cantidad = d.items.filter(l => l.item_code?.trim() === p.sku).reduce((s, l) => s.plus(l.quantity), new Prisma.Decimal(0));
      const referencia = `${d.serie}-${String(d.correlativo).padStart(8, '0')}`;
      const descargado = movimientos.filter(m => m.product_id === p.id && m.source_reference_id === referencia).reduce((s, m) => s.plus(m.quantity), new Prisma.Decimal(0));
      reservado = reservado.plus(Prisma.Decimal.max(0, cantidad.minus(descargado)));
    }
    const stock = new Prisma.Decimal(saldos.find(s => s.product_id === p.id)?.current_stock ?? 0);
    const pedido = dto.items.filter(l => l.codigo?.trim() === p.sku).reduce((s, l) => s.plus(l.cantidad), new Prisma.Decimal(0));
    if (pedido.greaterThan(stock.minus(reservado))) throw new ConflictException(`STOCK_COMPROMETIDO: ${p.sku}; disponible ${stock.minus(reservado).toString()}, solicitado ${pedido.toString()}`);
  }
}
