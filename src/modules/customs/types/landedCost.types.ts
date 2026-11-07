/**
 * Tipos para el cálculo de Costeo de Importación (Landed Cost bajo NIC 2 — Inventarios)
 * y gestión de facturas de proveedores locales.
 */

export type ProrationMethod = 'VALOR_FOB' | 'PESO_BRUTO' | 'UNIDADES' | 'VALOR_CIF';

export type LandedCostStatus =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'APROBADO'
  | 'A_AJUSTAR'
  | 'PROVISIONAL'
  | 'DEFINITIVO'
  | 'A_RECALCULAR';

export interface LocalExpenseInvoiceRecord {
  id: string;
  shipment_id: string;
  supplier_ruc: string;
  supplier_name: string;
  expense_concept: string; // ALMACENAJE, AGENCIA, TRANSPORTE_LOCAL, CUADRILLA
  invoice_serial_number: string;
  issue_date: string;
  net_amount_pen: number; // Base imponible que va al inventario
  igv_amount_pen: number; // Crédito fiscal aislado (NIC 2 párrafo 11)
  total_amount_pen: number;
  spot_detraction_rate?: number;
  is_capitalizable: boolean;
  proration_method: ProrationMethod;
}

export interface AddLocalExpensePayload {
  shipment_id: string;
  supplier_ruc: string;
  supplier_name: string;
  expense_concept: string;
  invoice_serial_number: string;
  issue_date: string;
  net_amount_pen: number;
  igv_amount_pen: number;
  total_amount_pen: number;
  spot_detraction_rate?: number;
  is_capitalizable?: boolean;
  proration_method: ProrationMethod;
}

export interface LandedCostSeriesBreakdown {
  series_id: string;
  series_order: number;
  product_code: string;
  commercial_description: string;
  physical_quantity: number;
  cif_pen: number;
  ad_valorem_pen: number;
  allocated_local_expenses_pen: number;
  total_landed_cost_pen: number;
  final_landed_cost_unit_pen: number;
  destination_type?: 'MERCADERIA' | 'ACTIVO_FIJO';
}

export interface LandedCostSheetRecord {
  id: string;
  shipment_id: string;
  calculation_date: string;
  total_cif_pen: number;
  total_duties_pen: number;
  total_local_expenses_pen: number;
  total_inventory_cost_pen: number;
  status: LandedCostStatus;
  approved_by_accountant: boolean;
  approved_at?: string;
  series_breakdown?: LandedCostSeriesBreakdown[];
}

export interface CalculateLandedCostPayload {
  shipment_id: string;
}

export interface ApproveLandedCostPayload {
  shipmentId: string;
  declarationId?: string;
  approvedByAccountant?: boolean;
  notes?: string;
}

export interface AdjustLateImportCostPayload {
  shipmentId: string;
  supplierRuc: string;
  supplierName: string;
  expenseConcept: string;
  invoiceSerialNumber: string;
  issueDate: string;
  netAmountPen: number;
  igvAmountPen: number;
  totalAmountPen: number;
  isCapitalizable?: boolean;
  prorationMethod?: ProrationMethod;
  adjustmentJustification?: string;
}

export interface ApplyKardexPayload {
  shipment_id: string;
}
