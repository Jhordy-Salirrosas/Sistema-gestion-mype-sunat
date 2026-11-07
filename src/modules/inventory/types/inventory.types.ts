export interface InventoryWarehouse {
  id: string;
  companyId: string;
  warehouseCode: string;
  sunatEstablishmentCode: string;
  description: string;
  address?: string | null;
  isActive: boolean;
}

export interface InventoryProduct {
  id: string;
  companyId: string;
  sku: string;
  description: string;
  sunatTypeCode: string;
  sunatUnitCode: string;
  minStockAlert: number;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  barcode?: string | null;
  hsCode?: string | null;
  weightKg?: number | null;
  volumeM3?: number | null;
  taxAffectation?: string | null;
  isActive: boolean;
}

export interface InventoryBalance {
  id: string;
  warehouseCode: string;
  sku: string;
  description: string;
  currentStock: number;
  averageUnitCost: number;
  totalInventoryValue: number;
  sunatTypeCode?: string;
  sunatUnitCode?: string;
  minStockAlert?: number;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  barcode?: string | null;
  hsCode?: string | null;
  weightKg?: number | null;
  volumeM3?: number | null;
  lastMovementAt?: string | null;
}

export interface InventoryMovement {
  id: string;
  warehouseCode: string;
  sku: string;
  description: string;
  movementNumber: string;
  movementDate: string;
  operationTypeCode: string;
  documentTypeCode?: string | null;
  documentSerial?: string | null;
  documentNumber?: string | null;
  direction: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost: number;
  totalCost: number;
  previousStock: number;
  resultingStock: number;
  resultingAverageCost: number;
  resultingTotalValue: number;
  sourceReferenceId?: string | null;
  notes?: string | null;
}

export interface InventoryBookObligation {
  id?: string;
  companyId: string;
  fiscalYear: number;
  annualRevenueUit: number;
  taxRegime: string;
  ple12_1Status: 'OBLIGATORIO' | 'EXCEPTUADO' | 'VOLUNTARIO';
  ple13_1Status: 'OBLIGATORIO' | 'EXCEPTUADO' | 'VOLUNTARIO';
  legalBasisNotes?: string | null;
  evaluatedAt?: string;
}

export interface StockSummaryResponse {
  totalValuationPen: number;
  totalItemsCount: number;
  balances: InventoryBalance[];
}

export interface KardexLedgerResponse {
  product: {
    id: string;
    sku: string;
    description: string;
    sunatTypeCode: string;
    sunatUnitCode: string;
  };
  summary?: {
    totalStock: number;
    averageCost: number;
    totalValuation: number;
    warehouseBalances?: Array<{
      warehouseCode: string;
      warehouseDescription?: string;
      stock: number;
      averageCost: number;
      totalValue: number;
    }>;
  };
  movements: InventoryMovement[];
}

