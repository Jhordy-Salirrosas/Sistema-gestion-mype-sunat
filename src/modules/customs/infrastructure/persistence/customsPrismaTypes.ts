export interface PrismaCustomsDeclarationRow {
  id: string;
  company_id: string;
  shipment_id?: string | null;
  dua_number: string;
  customs_agency_code: string;
  regime_code: string;
  dispatch_mode?: string;
  channel?: string;
  transport_doc_number?: string | null;
  manifest_number?: string | null;
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
  series_order?: number | null;
  product_code?: string | null;
  hs_code: string;
  commercial_description: string;
  goods_state?: string;
  quantity: unknown;
  unit_code: string;
  net_weight_kg?: unknown;
  gross_weight_kg?: unknown;
  fob_unit_usd: unknown;
  fob_total_usd: unknown;
  allocated_cif_pen: unknown;
  allocated_duties_pen: unknown;
  allocated_local_cost_pen?: unknown;
  landed_cost_unit_pen: unknown;
  final_landed_cost_unit_pen?: unknown;
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
