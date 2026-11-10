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
      where: {
        company_id: companyId,
        // Los servicios y productos descontinuados no forman parte del inventario comercial activo.
        product: { is: { is_inventory: true, is_active: true } },
      },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { updated_at: 'desc' },
    });

    return rows.map((r) => {
      const entity = this.toDomain(r);
      return Object.assign(entity, {
        sku: r.product?.sku ?? 'SIN-SKU',
        productDescription: r.product?.description ?? 'Producto sin descripción',
        warehouseCode: r.warehouse?.warehouse_code ?? 'ALM-01',
        origin_type: r.product?.origin_type ?? 'NACIONAL',
        is_service: r.product?.is_service ?? false,
        brand: r.product?.brand ?? null,
        model: r.product?.model ?? null,
        category: r.product?.category ?? null,
        manufacturer: r.product?.manufacturer ?? null,
        country_of_origin: r.product?.country_of_origin ?? null,
        tags: r.product?.tags ?? [],
        barcode: r.product?.barcode ?? null,
        hsCode: r.product?.hs_code ?? null,
        weightKg: r.product?.weight_kg ? Number(r.product.weight_kg) : null,
        volumeM3: r.product?.volume_m3 ? Number(r.product.volume_m3) : null,
        taxAffectation: r.product?.tax_affectation ?? '10',
        cost_price: r.product?.cost_price ? Number(r.product.cost_price) : null,
        sale_price: r.product?.sale_price ? Number(r.product.sale_price) : null,
        wholesale_price: r.product?.wholesale_price ? Number(r.product.wholesale_price) : null,
        promo_price: r.product?.promo_price ? Number(r.product.promo_price) : null,
        commission_rate: r.product?.commission_rate ? Number(r.product.commission_rate) : null,
        min_price: r.product?.min_price ? Number(r.product.min_price) : null,
        warehouse_location: r.product?.warehouse_location ?? null,
        attributes: Array.isArray(r.product?.attributes) ? r.product.attributes : [],
        sunatTypeCode: r.product?.sunat_type_code ?? '01',
        sunatUnitCode: r.product?.sunat_unit_code ?? 'NIU',
        minStockAlert: r.product?.min_stock_alert ? Number(r.product.min_stock_alert) : 0,
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