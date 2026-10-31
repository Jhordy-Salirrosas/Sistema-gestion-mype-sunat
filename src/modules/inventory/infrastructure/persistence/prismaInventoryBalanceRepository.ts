import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  IInventoryBalanceRepositoryPort,
} from '../../domain/ports/IInventoryBalanceRepositoryPort';
import { InventoryBalanceEntity } from '../../domain/entities/inventoryBalanceEntity';

@Injectable()
export class PrismaInventoryBalanceRepository implements IInventoryBalanceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByWarehouseAndProduct(
    warehouseId: string,
    productId: string,
    companyId: string,
  ): Promise<InventoryBalanceEntity | null> {
    const row = await this.prisma.inventoryBalance.findFirst({
      where: {
        warehouse_id: warehouseId,
        product_id: productId,
        company_id: companyId,
      },
    });

    return row ? this.toDomain(row) : null;
  }

  async upsertBalance(balance: InventoryBalanceEntity): Promise<InventoryBalanceEntity> {
    const row = await this.prisma.inventoryBalance.upsert({
      where: {
        company_id_warehouse_id_product_id: {
          company_id: balance.companyId,
          warehouse_id: balance.warehouseId,
          product_id: balance.productId,
        },
      },
      create: {
        id: balance.id,
        company_id: balance.companyId,
        warehouse_id: balance.warehouseId,
        product_id: balance.productId,
        current_stock: balance.currentStock,
        average_unit_cost: balance.averageUnitCost,
        total_inventory_value: balance.totalInventoryValue,
        last_movement_at: balance.lastMovementAt ?? new Date(),
      },
      update: {
        current_stock: balance.currentStock,
        average_unit_cost: balance.averageUnitCost,
        total_inventory_value: balance.totalInventoryValue,
        last_movement_at: balance.lastMovementAt ?? new Date(),
      },
    });

    return this.toDomain(row);
  }

  async findAllByCompany(companyId: string): Promise<
    (InventoryBalanceEntity & {
      sku: string;
      productDescription: string;
      warehouseCode: string;
    })[]
  > {
    const rows = await this.prisma.inventoryBalance.findMany({
      where: { company_id: companyId },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { product: { sku: 'asc' } },
    });

    return rows.map((r) => {
      const entity = this.toDomain(r);
      return Object.assign(entity, {
        sku: r.product.sku,
        productDescription: r.product.description,
        warehouseCode: r.warehouse.warehouse_code,
      });
    });
  }

  private toDomain(row: {
    id: string;
    company_id: string;
    warehouse_id: string;
    product_id: string;
    current_stock: unknown;
    average_unit_cost: unknown;
    total_inventory_value: unknown;
    last_movement_at: Date | null;
    updated_at: Date;
  }): InventoryBalanceEntity {
    return new InventoryBalanceEntity({
      id: row.id,
      companyId: row.company_id,
      warehouseId: row.warehouse_id,
      productId: row.product_id,
      currentStock: Number(row.current_stock),
      averageUnitCost: Number(row.average_unit_cost),
      totalInventoryValue: Number(row.total_inventory_value),
      lastMovementAt: row.last_movement_at,
      updatedAt: row.updated_at,
    });
  }
}

