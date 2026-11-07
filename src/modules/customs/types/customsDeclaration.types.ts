/**
 * Tipos para la Declaración Aduanera de Mercancías (DAM / DUA),
 * series arancelarias (Formato B) y liquidaciones oficiales con CDA.
 */

export type CustomsChannel = 'PENDIENTE' | 'VERDE' | 'NARANJA' | 'ROJO';

export type DispatchMode = '10' | '00' | '01' | '02'; // 10 Anticipado, 00 Diferido, 01/02 Urgente

export type SettlementType =
  | 'TIPO_0010_DECLARACION'
  | 'TIPO_0026_MAYOR_VALOR'
  | 'TIPO_0027_MULTA'
  | 'RESOLUCION_MULTA_RM65';

export type SettlementStatus = 'GENERADA' | 'PAGADA' | 'GARANTIZADA' | 'VENCIDA' | 'ANULADA';

export interface CustomsItemDetail {
  id?: string;
  declaration_id?: string;
  series_order: number;
  product_code: string;
  hs_code: string; // SPN de 10 dígitos numéricos
  commercial_description: string;
  goods_state?: 'NUEVO' | 'USADO';
  destination_type?: 'MERCADERIA' | 'ACTIVO_FIJO';
  tpi_code?: string; // Código de TLC (ej. 800 China)
  physical_quantity: number;
  physical_unit: string; // NIU, KGM
  net_weight_kg: number;
  gross_weight_kg: number;
  fob_usd: number;
  freight_usd?: number;
  insurance_usd?: number;
  cif_usd?: number;
  cif_pen?: number;
  ad_valorem_rate: number;
  ad_valorem_pen?: number;
  igv_pen?: number;
  ipm_pen?: number;
  perception_pen?: number;
  allocated_local_cost_pen?: number;
  final_landed_cost_unit_pen?: number;
}

export interface CustomsSettlementRecord {
  id: string;
  declaration_id: string;
  settlement_type: SettlementType;
  settlement_number: string;
  tax_code: string; // 0001, 0002, 0096, 0027
  amount_usd: number;
  amount_pen: number;
  due_date: string;
  status: SettlementStatus;
  paid_at?: string;
  bank_code?: string; // 002 BCP, 011 BBVA, 018 BN
  bank_operation_number?: string;
  voucher_storage_url?: string;
  cda_number?: string; // Código de Documento Aduanero (14 dígitos)
}

export interface CustomsDeclarationRecord {
  id: string;
  company_id: string;
  shipment_id: string;
  dua_number: string; // Formato 118-2026-10-123456
  customs_code: string; // 118, 235, 370
  declaration_year: number;
  regime_code: string;
  correlative_number: string;
  numeration_date: string;
  dispatch_mode: DispatchMode;
  channel: CustomsChannel;
  transport_doc_number: string;
  manifest_number?: string;
  fob_total_usd: number;
  freight_total_usd: number;
  insurance_total_usd: number;
  cif_total_usd: number;
  exchange_rate: number;
  cif_total_pen: number;
  total_ad_valorem_pen: number;
  total_igv_pen: number;
  total_ipm_pen: number;
  total_perception_pen: number;
  has_article_160_guarantee: boolean;
  version: number;
  created_at: string;
  series: CustomsItemDetail[];
  settlements?: CustomsSettlementRecord[];
  supplier_name?: string;
  supplier_tax_id?: string;
  supplier_country?: string;
  commercial_invoice_number?: string;
  incoterm?: string;
}

export interface RegisterDuaWizardItemPayload {
  series_order: number;
  product_code: string;
  hs_code: string;
  commercial_description: string;
  goods_state?: 'NUEVO' | 'USADO';
  destination_type?: 'MERCADERIA' | 'ACTIVO_FIJO';
  tpi_code?: string;
  physical_quantity: number;
  physical_unit: string;
  net_weight_kg: number;
  gross_weight_kg: number;
  fob_usd: number;
  ad_valorem_rate: number;
}

export interface RegisterDuaWizardPayload {
  shipment_id: string;
  customs_code: string;
  declaration_year: number;
  correlative_number: string;
  numeration_date: string;
  dispatch_mode: DispatchMode;
  channel?: CustomsChannel;
  transport_doc_number: string;
  manifest_number?: string;
  fob_total_usd: number;
  freight_total_usd: number;
  insurance_total_usd?: number; // Si es 0 o no se envía, se activa TPPS
  exchange_rate: number;
  has_article_160_guarantee?: boolean;
  items: RegisterDuaWizardItemPayload[];
}

export interface PaySettlementPayload {
  bank_code: string;
  bank_operation_number: string;
  paid_at?: string;
  voucher_storage_url?: string;
}
