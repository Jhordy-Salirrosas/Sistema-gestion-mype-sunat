import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  IGoodsReceiptRepositoryPort,
} from '../../domain/ports/goodsReceiptRepositoryPort';
import {
  GoodsReceiptEntity,
  GoodsReceiptItemEntity,
} from '../../domain/entities/goodsReceiptEntity';
import { Prisma } from '../../../../generated/client/client';

@Injectable()
export class PrismaGoodsReceiptRepository implements IGoodsReceiptRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(receipt: GoodsReceiptEntity): Promise<GoodsReceiptEntity> {
    const raw = receipt.toPrimitives();

    const created = await this.prisma.goodsReceipt.create({
      data: {
        id: raw.id,
        company_id: raw.companyId,
        receipt_number: raw.receiptNumber,
        declaration_id: raw.declarationId,
        shipment_id: raw.shipmentId,
        warehouse_code: raw.warehouseCode,
        reception_date: raw.receptionDate,
        reception_type: raw.receptionType,
        responsible_name: raw.responsibleName,
        responsible_dni: raw.responsibleDni,
        container_number: raw.containerNumber,
        seal_number: raw.sealNumber,
        status: raw.status as any,
        observations: raw.observations,
        items: {
          create: receipt.items.map((it) => ({
            id: it.id,
            customs_item_id: it.toPrimitives().customsItemId,
            product_code: it.productCode,
            commercial_description: it.commercialDescription,
            declared_quantity: new Prisma.Decimal(it.declaredQuantity),
            received_quantity: new Prisma.Decimal(it.receivedQuantity),
            damaged_quantity: new Prisma.Decimal(it.damagedQuantity),
            difference_quantity: new Prisma.Decimal(it.differenceQuantity),
            discrepancy_reason: it.discrepancyReason,
            unit_code: it.unitCode,
            destination_type: it.destinationType as any,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return this.mapToDomain(created);
  }

  async findById(id: string, companyId: string): Promise<GoodsReceiptEntity | null> {
    const row = await this.prisma.goodsReceipt.findFirst({
      where: { id, company_id: companyId },
      include: { items: true },
    });
    return row ? this.mapToDomain(row) : null;
  }

  async findByReceiptNumber(
    receiptNumber: string,
    companyId: string,
  ): Promise<GoodsReceiptEntity | null> {
    const row = await this.prisma.goodsReceipt.findFirst({
      where: { receipt_number: receiptNumber, company_id: companyId },
      include: { items: true },
    });
    return row ? this.mapToDomain(row) : null;
  }

  async findByDeclarationId(
    declarationId: string,
    companyId: string,
  ): Promise<GoodsReceiptEntity[]> {
    const rows = await this.prisma.goodsReceipt.findMany({
      where: { declaration_id: declarationId, company_id: companyId },
      include: { items: true },
      orderBy: { reception_date: 'desc' },
    });
    return rows.map((r) => this.mapToDomain(r));
  }

  async listByCompany(
    companyId: string,
    options?: { declarationId?: string; status?: string },
  ): Promise<GoodsReceiptEntity[]> {
    const where: Prisma.GoodsReceiptWhereInput = {
      company_id: companyId,
    };
    if (options?.declarationId) {
      where.declaration_id = options.declarationId;
    }
    if (options?.status) {
      where.status = options.status as any;
    }

    const rows = await this.prisma.goodsReceipt.findMany({
      where,
      include: { items: true },
      orderBy: { reception_date: 'desc' },
    });
    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): GoodsReceiptEntity {
    const items = (row.items || []).map(
      (it: any) =>
        new GoodsReceiptItemEntity({
          id: it.id,
          goodsReceiptId: it.goods_receipt_id,
          customsItemId: it.customs_item_id,
          productCode: it.product_code,
          commercialDescription: it.commercial_description,
          declaredQuantity: Number(it.declared_quantity),
          receivedQuantity: Number(it.received_quantity),
          damagedQuantity: Number(it.damaged_quantity),
          differenceQuantity: Number(it.difference_quantity),
          discrepancyReason: it.discrepancy_reason,
          unitCode: it.unit_code,
          destinationType: it.destination_type,
        }),
    );

    return new GoodsReceiptEntity({
      id: row.id,
      companyId: row.company_id,
      receiptNumber: row.receipt_number,
      declarationId: row.declaration_id,
      shipmentId: row.shipment_id,
      warehouseCode: row.warehouse_code,
      receptionDate: row.reception_date,
      receptionType: row.reception_type,
      responsibleName: row.responsible_name,
      responsibleDni: row.responsible_dni,
      containerNumber: row.container_number,
      sealNumber: rawSealNumber(row),
      status: row.status,
      observations: row.observations,
      items,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

function rawSealNumber(row: any): string | null {
  return row.seal_number ?? null;
}
