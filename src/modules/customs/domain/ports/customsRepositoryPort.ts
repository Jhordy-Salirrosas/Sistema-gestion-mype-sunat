import { CustomsDeclarationEntity } from '../entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../entities/customsItemEntity';

export interface KardexMovementRecord {
  id?: string;
  companyId: string;
  movementDate: Date;
  movementType: 'INGRESO_IMPORTACION' | 'SALIDA_VENTA' | 'AJUSTE_INVENTARIO';
  itemCode: string;
  description: string;
  sourceReferenceId?: string | null;
  quantityIn: number;
  unitCostIn: number;
  totalCostIn: number;
  quantityOut: number;
  unitCostOut: number;
  totalCostOut: number;
  finalStockQuantity: number;
  finalAverageUnitCost: number;
  finalTotalInventoryValue: number;
  createdAt?: Date;
}

export interface CustomsDeclarationSummary {
  id: string;
  duaNumber: string;
  customsAgencyCode: string;
  numerationDate: Date;
  cifValueUsd: number;
  cifValuePen: number;
  totalCustomsTaxesPen: number;
  status: string;
  itemsCount: number;
  createdAt: Date;
}

export const CUSTOMS_REPOSITORY_PORT = Symbol('CUSTOMS_REPOSITORY_PORT');

export interface ICustomsRepositoryPort {
  saveDeclarationWithItemsAndKardex(
    declaration: CustomsDeclarationEntity,
    items: CustomsItemEntity[],
    kardexMovements: KardexMovementRecord[],
  ): Promise<CustomsDeclarationEntity>;

  findDeclarationById(
    id: string,
    companyId: string,
  ): Promise<CustomsDeclarationEntity | null>;

  findDeclarationsByCompany(
    companyId: string,
  ): Promise<CustomsDeclarationSummary[]>;

  findKardexMovementsByCompany(
    companyId: string,
  ): Promise<KardexMovementRecord[]>;

  findLatestKardexMovementByItem(
    companyId: string,
    itemCode: string,
  ): Promise<KardexMovementRecord | null>;
}
