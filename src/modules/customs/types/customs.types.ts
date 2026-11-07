/**
 * Tipos y Contratos de Datos para el Módulo 3: Ingesta Aduanera e Importaciones (DUA/DAM & Kardex).
 * Sincronizados 1:1 con las entidades y DTOs del Backend (NestJS + Supabase).
 */

export type CustomsStatus = 'REGISTRADO' | 'LIQUIDADO' | 'APLICADO_KARDEX' | 'ANULADO';

export type KardexMovementType = 'INGRESO_IMPORTACION' | 'SALIDA_VENTA' | 'AJUSTE_INVENTARIO';

export interface CustomsItem {
  id?: string;
  item_order: number;
  item_code?: string;
  hs_code: string;
  commercial_description: string;
  quantity: number;
  unit_code: string;
  fob_unit_usd: number;
  fob_total_usd?: number;
  allocated_cif_pen?: number;
  allocated_duties_pen?: number;
  landed_cost_unit_pen?: number;
}

export interface CustomsDeclarationSummary {
  id: string;
  dua_number: string;
  customs_agency_code: string;
  numeration_date: string;
  cif_value_usd: number;
  cif_value_pen: number;
  total_customs_taxes_pen: number;
  status: CustomsStatus;
  items_count: number;
  created_at: string;
}

export interface CustomsDeclarationDetail {
  id: string;
  dua_number: string;
  customs_agency_code: string;
  regime_code: string;
  numeration_date: string;
  fob_value_usd: number;
  freight_value_usd: number;
  insurance_value_usd: number;
  cif_value_usd: number;
  exchange_rate: number;
  cif_value_pen: number;
  ad_valorem_rate: number;
  ad_valorem_amount_pen: number;
  igv_rate?: number;
  ipm_rate?: number;
  igv_ipm_amount_pen: number;
  perception_rate: number;
  perception_amount_pen: number;
  total_customs_taxes_pen: number;
  status: CustomsStatus;
  items: CustomsItem[];
  kardex_movements_registered?: number;
  created_at: string;
}

export interface RegisterDuaItemPayload {
  item_order: number;
  item_code?: string;
  hs_code: string;
  commercial_description: string;
  quantity: number;
  unit_code: string;
  fob_unit_usd: number;
}

export interface RegisterDuaPayload {
  dua_number: string;
  customs_agency_code: string;
  regime_code?: string;
  numeration_date: string;
  fob_value_usd: number;
  freight_value_usd: number;
  insurance_value_usd: number;
  exchange_rate: number;
  ad_valorem_rate: number;
  perception_rate: number;
  items: RegisterDuaItemPayload[];
}

export interface CalculateDuaPayload {
  fob_value_usd: number;
  freight_value_usd: number;
  insurance_value_usd: number;
  exchange_rate: number;
  ad_valorem_rate: number;
  perception_rate: number;
}

export interface DuaCalculationResult {
  cif_value_usd: number;
  cif_value_pen: number;
  ad_valorem_amount_pen: number;
  igv_ipm_amount_pen: number;
  perception_amount_pen: number;
  total_customs_taxes_pen: number;
  landed_cost_total_pen: number;
  fiscal_credit_pen: number;
}

export interface KardexMovementRecord {
  id: string;
  company_id: string;
  movement_date: string;
  movement_type: KardexMovementType;
  item_code: string;
  description: string;
  source_reference_id?: string;
  quantity_in: number;
  unit_cost_in: number;
  total_cost_in: number;
  quantity_out: number;
  unit_cost_out: number;
  total_cost_out: number;
  final_stock_quantity: number;
  final_average_unit_cost: number;
  final_total_inventory_value: number;
  created_at: string;
}
