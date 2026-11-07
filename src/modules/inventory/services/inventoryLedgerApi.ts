import { apiClient } from '@/lib/axios';

export interface TransferItemRecord {
  id: string;
  sku: string;
  description: string;
  quantity: string | number;
  unit_cost: string | number;
  total_cost: string | number;
}

export interface InventoryTransferRecord {
  id: string;
  transfer_number: string;
  transfer_date: string;
  from_warehouse_code: string;
  to_warehouse_code: string;
  status: string;
  responsible?: string | null;
  notes?: string | null;
  items: TransferItemRecord[];
}

export interface AdjustmentItemRecord {
  id: string;
  sku: string;
  description: string;
  system_quantity: string | number;
  counted_quantity: string | number;
  difference_quantity: string | number;
  unit_cost: string | number;
}

export interface InventoryAdjustmentRecord {
  id: string;
  adjustment_number: string;
  adjustment_date: string;
  warehouse_code: string;
  type: 'ENTRADA' | 'SALIDA';
  reason: string;
  status: string;
  responsible?: string | null;
  notes?: string | null;
  items: AdjustmentItemRecord[];
}

export interface KardexMovementRecord {
  id: string;
  date: string;
  movementNumber: string;
  operationTypeCode: string;
  operationLabel: string;
  documentTypeCode?: string | null;
  documentSerial?: string | null;
  documentNumber?: string | null;
  sku: string;
  description: string;
  unitCode: string;
  warehouseCode: string;
  direction: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost: number;
  totalCost: number;
  resultingStock: number;
  resultingAverageCost: number;
  resultingTotalValue: number;
  sourceModule?: string | null;
  isInternalTransfer: boolean;
  affectsConsolidated: boolean;
  balanceAfter: number;
}

export interface KardexResponse {
  mode: 'CONSOLIDATED' | 'WAREHOUSE';
  filters: Record<string, string | null>;
  opening: { stock: number; unitCost: number; totalValue: number };
  totals: {
    entries: number;
    exits: number;
    entriesQuantity: number;
    exitsQuantity: number;
    count: number;
  };
  internalTransfers: {
    count: number;
    entriesQuantity: number;
    exitsQuantity: number;
    entriesValue: number;
    exitsValue: number;
  };
  final: { stock: number; unitCost: number; totalValue: number };
  warehouses: Array<{ warehouseCode: string; stock: number; value: number }>;
  movements: KardexMovementRecord[];
}

export interface CreateOpeningPayload {
  openingDate?: string;
  warehouseCode?: string;
  notes?: string;
  items: Array<{ sku: string; quantity: number; unitCost: number }>;
}

export interface CreateTransferPayload {
  fromWarehouseCode: string;
  toWarehouseCode: string;
  transferDate?: string;
  responsible?: string;
  notes?: string;
  items: Array<{ sku: string; quantity: number }>;
}

export interface CreateAdjustmentPayload {
  warehouseCode: string;
  type: 'ENTRADA' | 'SALIDA';
  reason: string;
  adjustmentDate?: string;
  responsible?: string;
  notes?: string;
  items: Array<{ sku: string; quantity: number; unitCost?: number }>;
}

const BASE = '/inventory';

export const inventoryLedgerApi = {
  getTransfers: async (): Promise<InventoryTransferRecord[]> => {
    const { data } = await apiClient.get<InventoryTransferRecord[]>(
      `${BASE}/transfers`,
    );
    return data;
  },
  createTransfer: async (payload: CreateTransferPayload) => {
    const { data } = await apiClient.post<InventoryTransferRecord>(
      `${BASE}/transfers`,
      payload,
    );
    return data;
  },
  getAdjustments: async (): Promise<InventoryAdjustmentRecord[]> => {
    const { data } = await apiClient.get<InventoryAdjustmentRecord[]>(
      `${BASE}/adjustments`,
    );
    return data;
  },
  createAdjustment: async (payload: CreateAdjustmentPayload) => {
    const { data } = await apiClient.post<InventoryAdjustmentRecord>(
      `${BASE}/adjustments`,
      payload,
    );
    return data;
  },
  createOpening: async (payload: CreateOpeningPayload) => {
    const { data } = await apiClient.post(`${BASE}/opening`, payload);
    return data;
  },
  getKardex: async (params?: {
    sku?: string;
    warehouse?: string;
    start_date?: string;
    end_date?: string;
    operation?: string;
    document?: string;
  }): Promise<KardexResponse> => {
    const { data } = await apiClient.get<KardexResponse>(`${BASE}/kardex`, { params });
    return data;
  },
  getWarehouses: async () => {
    const { data } = await apiClient.get<Array<{ warehouse_code: string; description: string }>>(
      `${BASE}/stocks/warehouses`,
    );
    return data;
  },
  getCashAndBanks: async (params?: {
    start_date?: string;
    end_date?: string;
    direction?: string;
  }): Promise<TreasuryResponse> => {
    const { data } = await apiClient.get<TreasuryResponse>(`${BASE}/kardex/cash`, { params });
    return data;
  },
  getConsolidated: async (): Promise<ConsolidatedResponse> => {
    const { data } = await apiClient.get<ConsolidatedResponse>(`${BASE}/kardex/consolidated`);
    return data;
  },
  getAccountingMappings: async (): Promise<AccountingMappingRecord[]> => {
    const { data } = await apiClient.get<AccountingMappingRecord[]>('/accounting/mappings');
    return data;
  },
  updateAccountingMapping: async (mapping: {
    process_code: string;
    role_code: string;
    account_code: string;
  }) => {
    const { data } = await apiClient.put('/accounting/mappings', mapping);
    return data;
  },
};

export interface TreasuryItemRecord {
  id: string;
  date: string;
  direction: 'INGRESO' | 'EGRESO';
  documentReference?: string | null;
  counterpartName: string;
  concept: string;
  amount: number;
  currencyCode: string;
  paymentMethod: string;
  bankName?: string | null;
  sourceModule: string;
  runningBalance: number;
}

export interface TreasuryResponse {
  totals: {
    totalIngresos: number;
    totalEgresos: number;
    netBalance: number;
    count: number;
  };
  items: TreasuryItemRecord[];
}

export interface ConsolidatedProductRecord {
  id: string;
  sku: string;
  description: string;
  unitCode: string;
  typeCode: string;
  totalStock: number;
  averageUnitCost: number;
  totalValue: number;
  warehouses: Array<{
    warehouseCode: string;
    warehouseName: string;
    stock: number;
    averageCost: number;
    totalValue: number;
  }>;
}

export interface ConsolidatedResponse {
  totalProducts: number;
  totalStockGlobal: number;
  totalValueGlobal: number;
  products: ConsolidatedProductRecord[];
}

export interface AccountingMappingRecord {
  process_code: string;
  role_code: string;
  account_code: string;
  description: string;
  is_custom: boolean;
}
