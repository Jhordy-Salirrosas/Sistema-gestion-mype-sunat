import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  IInventoryWarehouseRepositoryPort,
} from '../../domain/ports/IInventoryWarehouseRepositoryPort';
import { InventoryWarehouseEntity } from '../../domain/entities/inventoryWarehouseEntity';

@Injectable()
export class PrismaInventoryWarehouseRepository implements IInventoryWarehouseRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(warehouse: InventoryWarehouseEntity): Promise<InventoryWarehouseEntity> {
    const row = await this.prisma.inventoryWarehouse.create({
      data: {
        id: warehouse.id,
        company_id: warehouse.companyId,
        warehouse_code: warehouse.warehouseCode,
        sunat_establishment_code: warehouse.sunatEstablishmentCode,
        description: warehouse.description,
        address: warehouse.address,
        is_active: warehouse.isActive,
      },
    });

    return this.toDomain(row);
  }

  async findById(id: string, companyId: string): Promise<InventoryWarehouseEntity | null> {
    const row = await this.prisma.inventoryWarehouse.findFirst({
      where: { id, company_id: companyId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCode(warehouseCode: string, companyId: string): Promise<InventoryWarehouseEntity | null> {
    const row = await this.prisma.inventoryWarehouse.findFirst({
      where: { warehouse_code: warehouseCode.trim().toUpperCase(), company_id: companyId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAllByCompany(companyId: string): Promise<InventoryWarehouseEntity[]> {
    const rows = await this.prisma.inventoryWarehouse.findMany({
      where: { company_id: companyId, is_active: true },
      orderBy: { warehouse_code: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async ensureDefaultWarehouse(companyId: string): Promise<InventoryWarehouseEntity> {
    const existing = await this.findByCode('ALM-01', companyId);
    if (existing) {
      return existing;
    }

    return this.create(
      new InventoryWarehouseEntity({
        companyId,
        warehouseCode: 'ALM-01',
        sunatEstablishmentCode: '0000',
        description: 'Almacén Principal Central',
      }),
    );
  }

  private toDomain(row: {
    id: string;
    company_id: string;
    warehouse_code: string;
    sunat_establishment_code: string;
    description: string;
    address: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }): InventoryWarehouseEntity {
    return new InventoryWarehouseEntity({
      id: row.id,
      companyId: row.company_id,
      warehouseCode: row.warehouse_code,
      sunatEstablishmentCode: row.sunat_establishment_code,
      description: row.description,
      address: row.address,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

