import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { FifoCostEngine, type CostLayer } from '../../domain/rules/FifoCostEngine';

/** Persistencia de capas FIFO por empresa, almacén y producto. */
@Injectable()
export class InventoryCostLayerService {
  constructor(private readonly prisma: PrismaService) {}

  async metodo(companyId: string): Promise<'PROMEDIO' | 'FIFO'> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { inventory_cost_method: true },
    });
    return company?.inventory_cost_method === 'FIFO' ? 'FIFO' : 'PROMEDIO';
  }

  async capas(companyId: string, warehouseId: string, productId: string): Promise<CostLayer[]> {
    const rows = await this.prisma.inventoryCostLayer.findMany({
      where: { company_id: companyId, warehouse_id: warehouseId, product_id: productId, quantity_remaining: { gt: 0 } },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => ({ quantity: Number(r.quantity_remaining), unitCost: Number(r.unit_cost) }));
  }

  async registrarEntrada(companyId: string, warehouseId: string, productId: string, quantity: number, unitCost: number) {
    await this.prisma.inventoryCostLayer.create({
      data: { company_id: companyId, warehouse_id: warehouseId, product_id: productId, quantity_remaining: quantity, unit_cost: unitCost },
    });
  }

  async consumir(companyId: string, warehouseId: string, productId: string, quantity: number) {
    let pendiente = quantity;
    const capas = await this.prisma.inventoryCostLayer.findMany({
      where: { company_id: companyId, warehouse_id: warehouseId, product_id: productId, quantity_remaining: { gt: 0 } },
      orderBy: { created_at: 'asc' },
    });
    for (const capa of capas) {
      if (pendiente <= 0) break;
      const disponible = Number(capa.quantity_remaining);
      const usar = Math.min(disponible, pendiente);
      await this.prisma.inventoryCostLayer.update({
        where: { id: capa.id },
        data: { quantity_remaining: disponible - usar },
      });
      pendiente -= usar;
    }
  }

  calcular(layers: CostLayer[], direction: 'ENTRADA' | 'SALIDA', quantity: number, unitCost?: number) {
    return FifoCostEngine.calculate({ layers, movementDirection: direction, quantity, unitCost });
  }
}
