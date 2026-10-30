import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  IInventoryMovementRepositoryPort,
} from '../../domain/ports/IInventoryMovementRepositoryPort';
import { InventoryMovementEntity } from '../../domain/entities/inventoryMovementEntity';

@Injectable()
export class PrismaInventoryMovementRepository implements IInventoryMovementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(movement: InventoryMovementEntity): Promise<InventoryMovementEntity> {
    const row = await this.prisma.inventoryMovement.create({
      data: {
        id: movement.id,
        company_id: movement.companyId,
        warehouse_id: movement.warehouseId,
        product_id: movement.productId,
        movement_number: movement.movementNumber,
        movement_date: movement.movementDate,
        accounting_date: movement.accountingDate,
        operation_type_code: movement.operationTypeCode,
        document_type_code: movement.documentTypeCode,
        document_serial: movement.documentSerial,
        document_number: movement.documentNumber,
        direction: movement.direction,
        quantity: movement.quantity,
        unit_cost: movement.unitCost,
        total_cost: movement.totalCost,
        previous_stock: movement.previousStock,
        previous_unit_cost: movement.previousUnitCost,
        previous_total_value: movement.previousTotalValue,
        resulting_stock: movement.resultingStock,
        resulting_unit_cost: movement.resultingUnitCost,
        resulting_total_value: movement.resultingTotalValue,
        source_reference_id: movement.sourceReferenceId,
        notes: movement.notes,
      },
    });

    return this.toDomain(row);
  }

  async findBySourceReference(
    sourceReferenceId: string,
    operationTypeCode: string,
    productId: string,
    companyId: string,
  ): Promise<InventoryMovementEntity | null> {
    const row = await this.prisma.inventoryMovement.findFirst({
      where: {
        company_id: companyId,
        source_reference_id: sourceReferenceId,
        operation_type_code: operationTypeCode,
        product_id: productId,
      },
    });

    return row ? this.toDomain(row) : null;
  }

  async findMovementsByProduct(
    productId: string,
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<InventoryMovementEntity[]> {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const rows = await this.prisma.inventoryMovement.findMany({
      where: {
        company_id: companyId,
        product_id: productId,
        ...(startDate || endDate ? { movement_date: dateFilter } : {}),
      },
      orderBy: [{ movement_date: 'asc' }, { created_at: 'asc' }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findAllByCompany(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<
    (InventoryMovementEntity & {
      sku: string;
      productDescription: string;
      warehouseCode: string;
    })[]
  > {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const rows = await this.prisma.inventoryMovement.findMany({
      where: {
        company_id: companyId,
        ...(startDate || endDate ? { movement_date: dateFilter } : {}),
      },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }],
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
    movement_number: string;
    movement_date: Date;
    accounting_date: Date;
    operation_type_code: string;
    document_type_code: string | null;
    document_serial: string | null;
    document_number: string | null;
    direction: 'ENTRADA' | 'SALIDA';
    quantity: unknown;
    unit_cost: unknown;
    total_cost: unknown;
    previous_stock: unknown;
    previous_unit_cost: unknown;
    previous_total_value: unknown;
    resulting_stock: unknown;
    resulting_unit_cost: unknown;
    resulting_total_value: unknown;
    source_reference_id: string | null;
    notes: string | null;
    created_at: Date;
  }): InventoryMovementEntity {
    return new InventoryMovementEntity({
      id: row.id,
      companyId: row.company_id,
      warehouseId: row.warehouse_id,
      productId: row.product_id,
      movementNumber: row.movement_number,
      movementDate: row.movement_date,
      accountingDate: row.accounting_date,
      operationTypeCode: row.operation_type_code,
      documentTypeCode: row.document_type_code,
      documentSerial: row.document_serial,
      documentNumber: row.document_number,
      direction: row.direction,
      quantity: Number(row.quantity),
      unitCost: Number(row.unit_cost),
      totalCost: Number(row.total_cost),
      previousStock: Number(row.previous_stock),
      previousUnitCost: Number(row.previous_unit_cost),
      previousTotalValue: Number(row.previous_total_value),
      resultingStock: Number(row.resulting_stock),
      resultingUnitCost: Number(row.resulting_unit_cost),
      resultingTotalValue: Number(row.resulting_total_value),
      sourceReferenceId: row.source_reference_id,
      notes: row.notes,
      createdAt: row.created_at,
    });
  }
}

