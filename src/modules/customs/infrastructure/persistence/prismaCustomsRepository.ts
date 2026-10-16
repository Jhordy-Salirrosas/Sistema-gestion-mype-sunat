import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { CustomsDeclarationEntity } from '../../domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../domain/entities/customsItemEntity';
import type {
  CustomsDeclarationSummary,
  ICustomsRepositoryPort,
  KardexMovementRecord,
} from '../../domain/ports/customsRepositoryPort';
import { CustomsPrismaMapper } from './customsPrismaMapper';

@Injectable()
export class PrismaCustomsRepository implements ICustomsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async saveDeclarationWithItemsAndKardex(
    declaration: CustomsDeclarationEntity,
    items: CustomsItemEntity[],
    kardexMovements: KardexMovementRecord[],
  ): Promise<CustomsDeclarationEntity> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Insertar cabecera de la DAM
      const createdDeclaration = await tx.customsDeclaration.create({
        data: CustomsPrismaMapper.toPrismaDeclarationCreate(declaration),
      });

      // 2. Insertar series e ítems de la DAM
      const createdItems: CustomsItemEntity[] = [];
      for (const item of items) {
        const createdRow = await tx.customsItem.create({
          data: CustomsPrismaMapper.toPrismaItemCreate(item, createdDeclaration.id),
        });
        createdItems.push(CustomsPrismaMapper.toDomainItem(createdRow, item.itemCode));
      }

      // 3. Insertar movimientos en Kardex
      for (const movement of kardexMovements) {
        await tx.kardexMovement.create({
          data: CustomsPrismaMapper.toPrismaKardexCreate(movement, createdDeclaration.id),
        });
      }

      return CustomsPrismaMapper.toDomainDeclaration(createdDeclaration, createdItems);
    });
  }

  async findDeclarationById(
    id: string,
    companyId: string,
  ): Promise<CustomsDeclarationEntity | null> {
    const row = await this.prisma.customsDeclaration.findFirst({
      where: { id, company_id: companyId },
      include: {
        items: {
          orderBy: { item_order: 'asc' },
        },
      },
    });

    if (!row) {
      return null;
    }

    const items = row.items.map((item) => CustomsPrismaMapper.toDomainItem(item));
    return CustomsPrismaMapper.toDomainDeclaration(row, items);
  }

  async findDeclarationsByCompany(companyId: string): Promise<CustomsDeclarationSummary[]> {
    const rows = await this.prisma.customsDeclaration.findMany({
      where: { company_id: companyId },
      orderBy: { numeration_date: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return rows.map((row) => CustomsPrismaMapper.toDomainSummary(row));
  }

  async findKardexMovementsByCompany(companyId: string): Promise<KardexMovementRecord[]> {
    const rows = await this.prisma.kardexMovement.findMany({
      where: { company_id: companyId },
      orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }],
    });

    return rows.map((row) => CustomsPrismaMapper.toDomainKardex(row));
  }

  async findLatestKardexMovementByItem(
    companyId: string,
    itemCode: string,
  ): Promise<KardexMovementRecord | null> {
    const row = await this.prisma.kardexMovement.findFirst({
      where: { company_id: companyId, item_code: itemCode },
      orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }],
    });

    return row ? CustomsPrismaMapper.toDomainKardex(row) : null;
  }
}
