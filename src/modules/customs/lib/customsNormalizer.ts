import {
  type CustomsDeclarationDetail,
  type CustomsDeclarationSummary,
  type CustomsStatus,
  type KardexMovementRecord,
  type KardexMovementType,
} from '../types/customs.types';

/**
 * Normaliza las declaraciones aduaneras soportando indistintamente
 * formatos camelCase (del backend NestJS) y snake_case (de BD / frontend).
 */
export const normalizeDeclarationSummary = (
  raw: Record<string, unknown>
): CustomsDeclarationSummary => {
  return {
    id: String(raw.id || ''),
    dua_number: String(raw.dua_number ?? raw.duaNumber ?? ''),
    customs_agency_code: String(raw.customs_agency_code ?? raw.customsAgencyCode ?? ''),
    numeration_date: String(raw.numeration_date ?? raw.numerationDate ?? ''),
    cif_value_usd: Number(raw.cif_value_usd ?? raw.cifValueUsd ?? 0),
    cif_value_pen: Number(raw.cif_value_pen ?? raw.cifValuePen ?? 0),
    total_customs_taxes_pen: Number(raw.total_customs_taxes_pen ?? raw.totalCustomsTaxesPen ?? 0),
    status: (raw.status as CustomsStatus) || 'REGISTRADO',
    items_count: Number(
      raw.items_count ??
        raw.itemsCount ??
        (Array.isArray(raw.items) ? raw.items.length : 0)
    ),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  };
};

/**
 * Normaliza los movimientos de Kardex permanente valorizado.
 */
export const normalizeKardexRecord = (
  raw: Record<string, unknown>
): KardexMovementRecord => {
  return {
    id: String(raw.id || ''),
    company_id: String(raw.company_id ?? raw.companyId ?? ''),
    movement_date: String(raw.movement_date ?? raw.movementDate ?? ''),
    movement_type: (raw.movement_type ?? raw.movementType ?? 'INGRESO_IMPORTACION') as KardexMovementType,
    item_code: String(raw.item_code ?? raw.itemCode ?? ''),
    description: String(raw.description || ''),
    source_reference_id:
      raw.source_reference_id != null
        ? String(raw.source_reference_id)
        : raw.sourceReferenceId != null
        ? String(raw.sourceReferenceId)
        : undefined,
    quantity_in: Number(raw.quantity_in ?? raw.quantityIn ?? 0),
    unit_cost_in: Number(raw.unit_cost_in ?? raw.unitCostIn ?? 0),
    total_cost_in: Number(raw.total_cost_in ?? raw.totalCostIn ?? 0),
    quantity_out: Number(raw.quantity_out ?? raw.quantityOut ?? 0),
    unit_cost_out: Number(raw.unit_cost_out ?? raw.unitCostOut ?? 0),
    total_cost_out: Number(raw.total_cost_out ?? raw.totalCostOut ?? 0),
    final_stock_quantity: Number(raw.final_stock_quantity ?? raw.finalStockQuantity ?? 0),
    final_average_unit_cost: Number(
      raw.final_average_unit_cost ?? raw.finalAverageUnitCost ?? 0
    ),
    final_total_inventory_value: Number(
      raw.final_total_inventory_value ?? raw.finalTotalInventoryValue ?? 0
    ),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  };
};

/**
 * Normaliza el detalle completo de una declaración DAM/DUA.
 */
export const normalizeDeclarationDetail = (
  raw: Record<string, unknown>
): CustomsDeclarationDetail => {
  const items = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[]).map((item, idx) => ({
        id: item.id ? String(item.id) : undefined,
        item_order: Number(item.item_order ?? item.itemOrder ?? idx + 1),
        item_code:
          item.item_code != null
            ? String(item.item_code)
            : item.itemCode != null
            ? String(item.itemCode)
            : undefined,
        hs_code: String(item.hs_code ?? item.hsCode ?? ''),
        commercial_description: String(
          item.commercial_description ?? item.commercialDescription ?? ''
        ),
        quantity: Number(item.quantity ?? 0),
        unit_code: String(item.unit_code ?? item.unitCode ?? 'NIU'),
        fob_unit_usd: Number(item.fob_unit_usd ?? item.fobUnitUsd ?? 0),
        fob_total_usd: Number(item.fob_total_usd ?? item.fobTotalUsd ?? 0),
        allocated_cif_pen: Number(item.allocated_cif_pen ?? item.allocatedCifPen ?? 0),
        allocated_duties_pen: Number(
          item.allocated_duties_pen ?? item.allocatedDutiesPen ?? 0
        ),
        landed_cost_unit_pen: Number(
          item.landed_cost_unit_pen ?? item.landedCostUnitPen ?? 0
        ),
      }))
    : [];

  return {
    id: String(raw.id || ''),
    dua_number: String(raw.dua_number ?? raw.duaNumber ?? ''),
    customs_agency_code: String(raw.customs_agency_code ?? raw.customsAgencyCode ?? ''),
    regime_code: String(raw.regime_code ?? raw.regimeCode ?? '10'),
    numeration_date: String(raw.numeration_date ?? raw.numerationDate ?? ''),
    fob_value_usd: Number(raw.fob_value_usd ?? raw.fobValueUsd ?? 0),
    freight_value_usd: Number(raw.freight_value_usd ?? raw.freightValueUsd ?? 0),
    insurance_value_usd: Number(raw.insurance_value_usd ?? raw.insuranceValueUsd ?? 0),
    cif_value_usd: Number(raw.cif_value_usd ?? raw.cifValueUsd ?? 0),
    exchange_rate: Number(raw.exchange_rate ?? raw.exchangeRate ?? 1),
    cif_value_pen: Number(raw.cif_value_pen ?? raw.cifValuePen ?? 0),
    ad_valorem_rate: Number(raw.ad_valorem_rate ?? raw.adValoremRate ?? 0),
    ad_valorem_amount_pen: Number(raw.ad_valorem_amount_pen ?? raw.adValoremAmountPen ?? 0),
    igv_rate:
      raw.igv_rate != null
        ? Number(raw.igv_rate)
        : raw.igvRate != null
        ? Number(raw.igvRate)
        : 16,
    ipm_rate:
      raw.ipm_rate != null
        ? Number(raw.ipm_rate)
        : raw.ipmRate != null
        ? Number(raw.ipmRate)
        : 2,
    igv_ipm_amount_pen: Number(raw.igv_ipm_amount_pen ?? raw.igvIpmAmountPen ?? 0),
    perception_rate: Number(raw.perception_rate ?? raw.perceptionRate ?? 0),
    perception_amount_pen: Number(
      raw.perception_amount_pen ?? raw.perceptionAmountPen ?? 0
    ),
    total_customs_taxes_pen: Number(
      raw.total_customs_taxes_pen ?? raw.totalCustomsTaxesPen ?? 0
    ),
    status: (raw.status as CustomsStatus) || 'REGISTRADO',
    items,
    kardex_movements_registered: Number(
      raw.kardex_movements_registered ?? raw.kardexMovementsRegistered ?? 0
    ),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  };
};
