import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  IInventoryProductRepositoryPort,
} from '../../domain/ports/IInventoryProductRepositoryPort';
import { InventoryProductEntity } from '../../domain/entities/inventoryProductEntity';

@Injectable()
export class PrismaInventoryProductRepository implements IInventoryProductRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(product: InventoryProductEntity): Promise<InventoryProductEntity> {
    const row = await this.prisma.inventoryProduct.create({
      data: {
        id: product.id,
        company_id: product.companyId,
        sku: product.sku,
        description: product.description,
        sunat_type_code: product.sunatTypeCode,
        sunat_unit_code: product.sunatUnitCode,
        min_stock_alert: product.minStockAlert,
        is_active: product.isActive,
      },
    });

    return this.toDomain(row);
  }

  async findById(id: string, companyId: string): Promise<InventoryProductEntity | null> {
    const row = await this.prisma.inventoryProduct.findFirst({
      where: { id, company_id: companyId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findBySku(sku: string, companyId: string): Promise<InventoryProductEntity | null> {
    const row = await this.prisma.inventoryProduct.findFirst({
      where: { sku: sku.trim(), company_id: companyId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAllByCompany(companyId: string): Promise<InventoryProductEntity[]> {
    const rows = await this.prisma.inventoryProduct.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { sku: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findOrCreateBySku(
    companyId: string,
    sku: string,
    defaultDescription: string,
  ): Promise<InventoryProductEntity> {
    const existing = await this.findBySku(sku, companyId);
    if (existing) {
      return existing;
    }

    return this.create(
      new InventoryProductEntity({
        companyId,
        sku: sku.trim(),
        description: defaultDescription.trim(),
        sunatTypeCode: '01',
        sunatUnitCode: 'NIU',
      }),
    );
  }

  private toDomain(row: {
    id: string;
    company_id: string;
    sku: string;
    description: string;
    sunat_type_code: string;
    sunat_unit_code: string;
    min_stock_alert: unknown;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }): InventoryProductEntity {
    return new InventoryProductEntity({
      id: row.id,
      companyId: row.company_id,
      sku: row.sku,
      description: row.description,
      sunatTypeCode: row.sunat_type_code,
      sunatUnitCode: row.sunat_unit_code,
      minStockAlert: Number(row.min_stock_alert),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

