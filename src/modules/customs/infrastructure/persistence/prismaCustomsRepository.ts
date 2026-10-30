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
    _kardexMovements?: KardexMovementRecord[],
  ): Promise<CustomsDeclarationEntity> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Insertar cabecera de la DAM
      const createdDeclaration = await tx.customsDeclaration.create({
        data: CustomsPrismaMapper.toPrismaDeclarationCreate(declaration),
      });

      // 2. Insertar series e ítems de la DAM (Kardex se administra de forma autónoma en inventory)
      const createdItems: CustomsItemEntity[] = [];
      for (const item of items) {
        const createdRow = await tx.customsItem.create({
          data: CustomsPrismaMapper.toPrismaItemCreate(item, createdDeclaration.id),
        });
        createdItems.push(CustomsPrismaMapper.toDomainItem(createdRow, item.itemCode));
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

  async findKardexMovementsByCompany(_companyId: string): Promise<KardexMovementRecord[]> {
    return [];
  }

  async findLatestKardexMovementByItem(
    _companyId: string,
    _itemCode: string,
  ): Promise<KardexMovementRecord | null> {
    return null;
  }

  async registerKardexMovements(
    _movements: KardexMovementRecord[],
    _declarationId?: string,
  ): Promise<void> {
    // Kardex se gestiona de manera autónoma en el módulo de Inventario
  }
}
