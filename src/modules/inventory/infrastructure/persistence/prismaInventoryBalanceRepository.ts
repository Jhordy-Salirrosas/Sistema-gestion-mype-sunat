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

    const mapped: any[] = rows.map((r) => {
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

    // Productos activos sin movimiento aún no tienen fila en inventory_balances.
    // Se listan igual para que el alta sea visible y no parezca que no se guardó.
    const products = await this.prisma.inventoryProduct.findMany({
      where: { company_id: companyId, is_inventory: true, is_active: true },
    });
    const conBalance = new Set(rows.map((r) => r.product_id));
    const almacen = await this.prisma.inventoryWarehouse.findFirst({
      where: { company_id: companyId }, orderBy: { created_at: 'asc' },
    });
    for (const product of products) {
      if (conBalance.has(product.id)) continue;
      const entity = new InventoryBalanceEntity({
        id: `sin-stock-${product.id}`,
        companyId,
        warehouseId: almacen?.id ?? 'ALM-01',
        productId: product.id,
        currentStock: 0,
        averageUnitCost: 0,
        totalInventoryValue: 0,
        lastMovementAt: undefined,
      });
      mapped.push(Object.assign(entity, {
        sku: product.sku,
        productDescription: product.description,
        warehouseCode: almacen?.warehouse_code ?? 'ALM-01',
        origin_type: product.origin_type,
        is_service: product.is_service,
        brand: product.brand,
        model: product.model,
        category: product.category,
        manufacturer: product.manufacturer,
        country_of_origin: product.country_of_origin,
        tags: product.tags ?? [],
        barcode: product.barcode,
        hsCode: product.hs_code,
        weightKg: product.weight_kg ? Number(product.weight_kg) : null,
        volumeM3: product.volume_m3 ? Number(product.volume_m3) : null,
        taxAffectation: product.tax_affectation,
        cost_price: product.cost_price ? Number(product.cost_price) : null,
        sale_price: product.sale_price ? Number(product.sale_price) : null,
        wholesale_price: product.wholesale_price ? Number(product.wholesale_price) : null,
        promo_price: product.promo_price ? Number(product.promo_price) : null,
        commission_rate: product.commission_rate ? Number(product.commission_rate) : null,
        min_price: product.min_price ? Number(product.min_price) : null,
        warehouse_location: product.warehouse_location,
        attributes: Array.isArray(product.attributes) ? product.attributes : [],
        sunatTypeCode: product.sunat_type_code,
        sunatUnitCode: product.sunat_unit_code,
        minStockAlert: product.min_stock_alert ? Number(product.min_stock_alert) : 0,
      }));
    }
    return mapped;
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