import {
  CustomsDeclarationEntity,
  CustomsDeclarationStatus,
} from '../../domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../domain/entities/customsItemEntity';
import type {
  CustomsDeclarationSummary,
  KardexMovementRecord,
} from '../../domain/ports/customsRepositoryPort';

export interface PrismaCustomsDeclarationRow {
  id: string;
  company_id: string;
  dua_number: string;
  customs_agency_code: string;
  regime_code: string;
  numeration_date: Date;
  fob_value_usd: unknown;
  freight_value_usd: unknown;
  insurance_value_usd: unknown;
  cif_value_usd: unknown;
  exchange_rate: unknown;
  cif_value_pen: unknown;
  ad_valorem_rate: unknown;
  ad_valorem_amount_pen: unknown;
  igv_rate: unknown;
  ipm_rate: unknown;
  igv_ipm_amount_pen: unknown;
  perception_rate: unknown;
  perception_amount_pen: unknown;
  total_customs_taxes_pen: unknown;
  status: string;
  dua_pdf_storage_url?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PrismaCustomsItemRow {
  id: string;
  declaration_id: string;
  item_order: number;
  hs_code: string;
  commercial_description: string;
  quantity: unknown;
  unit_code: string;
  fob_unit_usd: unknown;
  fob_total_usd: unknown;
  allocated_cif_pen: unknown;
  allocated_duties_pen: unknown;
  landed_cost_unit_pen: unknown;
}

export interface PrismaKardexMovementRow {
  id: string;
  company_id: string;
  movement_date: Date;
  movement_type: string;
  item_code: string;
  description: string;
  source_reference_id?: string | null;
  quantity_in: unknown;
  unit_cost_in: unknown;
  total_cost_in: unknown;
  quantity_out: unknown;
  unit_cost_out: unknown;
  total_cost_out: unknown;
  final_stock_quantity: unknown;
  final_average_unit_cost: unknown;
  final_total_inventory_value: unknown;
  created_at: Date;
}

export class CustomsPrismaMapper {
  static toDomainDeclaration(
    row: PrismaCustomsDeclarationRow,
    items: CustomsItemEntity[] = [],
  ): CustomsDeclarationEntity {
    return new CustomsDeclarationEntity({
      id: row.id,
      companyId: row.company_id,
      duaNumber: row.dua_number,
      customsAgencyCode: row.customs_agency_code,
      regimeCode: row.regime_code,
      numerationDate: row.numeration_date,
      fobValueUsd: Number(row.fob_value_usd),
      freightValueUsd: Number(row.freight_value_usd),
      insuranceValueUsd: Number(row.insurance_value_usd),
      cifValueUsd: Number(row.cif_value_usd),
      exchangeRate: Number(row.exchange_rate),
      cifValuePen: Number(row.cif_value_pen),
      adValoremRate: Number(row.ad_valorem_rate),
      adValoremAmountPen: Number(row.ad_valorem_amount_pen),
      igvRate: Number(row.igv_rate),
      ipmRate: Number(row.ipm_rate),
      igvIpmAmountPen: Number(row.igv_ipm_amount_pen),
      perceptionRate: Number(row.perception_rate),
      perceptionAmountPen: Number(row.perception_amount_pen),
      totalCustomsTaxesPen: Number(row.total_customs_taxes_pen),
      status: row.status as CustomsDeclarationStatus,
      duaPdfStorageUrl: row.dua_pdf_storage_url,
      items,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  static toDomainItem(row: PrismaCustomsItemRow, itemCode?: string): CustomsItemEntity {
    return new CustomsItemEntity({
      id: row.id,
      declarationId: row.declaration_id,
      itemOrder: row.item_order,
      itemCode,
      hsCode: row.hs_code,
      commercialDescription: row.commercial_description,
      quantity: Number(row.quantity),
      unitCode: row.unit_code,
      fobUnitUsd: Number(row.fob_unit_usd),
      fobTotalUsd: Number(row.fob_total_usd),
      allocatedCifPen: Number(row.allocated_cif_pen),
      allocatedDutiesPen: Number(row.allocated_duties_pen),
      landedCostUnitPen: Number(row.landed_cost_unit_pen),
    });
  }

  static toDomainSummary(row: {
    id: string;
    dua_number: string;
    customs_agency_code: string;
    numeration_date: Date;
    cif_value_usd: unknown;
    cif_value_pen: unknown;
    total_customs_taxes_pen: unknown;
    status: string;
    _count: { items: number };
    created_at: Date;
  }): CustomsDeclarationSummary {
    return {
      id: row.id,
      duaNumber: row.dua_number,
      customsAgencyCode: row.customs_agency_code,
      numerationDate: row.numeration_date,
      cifValueUsd: Number(row.cif_value_usd),
      cifValuePen: Number(row.cif_value_pen),
      totalCustomsTaxesPen: Number(row.total_customs_taxes_pen),
      status: row.status,
      itemsCount: row._count.items,
      createdAt: row.created_at,
    };
  }

  static toDomainKardex(row: PrismaKardexMovementRow): KardexMovementRecord {
    return {
      id: row.id,
      companyId: row.company_id,
      movementDate: row.movement_date,
      movementType: row.movement_type as 'INGRESO_IMPORTACION' | 'SALIDA_VENTA' | 'AJUSTE_INVENTARIO',
      itemCode: row.item_code,
      description: row.description,
      sourceReferenceId: row.source_reference_id,
      quantityIn: Number(row.quantity_in),
      unitCostIn: Number(row.unit_cost_in),
      totalCostIn: Number(row.total_cost_in),
      quantityOut: Number(row.quantity_out),
      unitCostOut: Number(row.unit_cost_out),
      totalCostOut: Number(row.total_cost_out),
      finalStockQuantity: Number(row.final_stock_quantity),
      finalAverageUnitCost: Number(row.final_average_unit_cost),
      finalTotalInventoryValue: Number(row.final_total_inventory_value),
      createdAt: row.created_at,
    };
  }

  static toPrismaDeclarationCreate(declaration: CustomsDeclarationEntity) {
    return {
      company_id: declaration.companyId,
      dua_number: declaration.duaNumber,
      customs_agency_code: declaration.customsAgencyCode,
      regime_code: declaration.regimeCode,
      numeration_date: declaration.numerationDate,
      fob_value_usd: declaration.fobValueUsd,
      freight_value_usd: declaration.freightValueUsd,
      insurance_value_usd: declaration.insuranceValueUsd,
      cif_value_usd: declaration.cifValueUsd,
      exchange_rate: declaration.exchangeRate,
      cif_value_pen: declaration.cifValuePen,
      ad_valorem_rate: declaration.adValoremRate,
      ad_valorem_amount_pen: declaration.adValoremAmountPen,
      igv_rate: declaration.igvRate,
      ipm_rate: declaration.ipmRate,
      igv_ipm_amount_pen: declaration.igvIpmAmountPen,
      perception_rate: declaration.perceptionRate,
      perception_amount_pen: declaration.perceptionAmountPen,
      total_customs_taxes_pen: declaration.totalCustomsTaxesPen,
      status: declaration.status,
      dua_pdf_storage_url: declaration.duaPdfStorageUrl,
    };
  }

  static toPrismaItemCreate(item: CustomsItemEntity, declarationId: string) {
    return {
      declaration_id: declarationId,
      item_order: item.itemOrder,
      hs_code: item.hsCode,
      commercial_description: item.commercialDescription,
      quantity: item.quantity,
      unit_code: item.unitCode,
      fob_unit_usd: item.fobUnitUsd,
      fob_total_usd: item.fobTotalUsd,
      allocated_cif_pen: item.allocatedCifPen,
      allocated_duties_pen: item.allocatedDutiesPen,
      landed_cost_unit_pen: item.landedCostUnitPen,
    };
  }

  static toPrismaKardexCreate(movement: KardexMovementRecord, declarationId: string) {
    return {
      company_id: movement.companyId,
      movement_date: movement.movementDate,
      movement_type: movement.movementType,
      item_code: movement.itemCode,
      description: movement.description,
      source_reference_id: declarationId,
      quantity_in: movement.quantityIn,
      unit_cost_in: movement.unitCostIn,
      total_cost_in: movement.totalCostIn,
      quantity_out: movement.quantityOut,
      unit_cost_out: movement.unitCostOut,
      total_cost_out: movement.totalCostOut,
      final_stock_quantity: movement.finalStockQuantity,
      final_average_unit_cost: movement.finalAverageUnitCost,
      final_total_inventory_value: movement.finalTotalInventoryValue,
    };
  }
}

