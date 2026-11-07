import { apiClient } from '@/lib/axios';

export interface NationalPurchaseItemPayload {
  sku: string;
  quantity: number;
  unitCost: number;
  description?: string;
}

export interface CreateNationalPurchasePayload {
  supplierDocNumber: string;
  supplierName: string;
  supplierId?: string;
  documentTypeCode: string;
  documentSerial: string;
  documentNumber: string;
  issueDate: string;
  warehouseCode?: string;
  currencyCode?: string;
  responsible?: string;
  notes?: string;
  items: NationalPurchaseItemPayload[];
}

export interface NationalPurchaseRecord {
  id: string;
  purchaseNumber: string;
  supplierDocNumber: string;
  supplierName: string;
  documentTypeCode: string;
  documentSerial: string;
  documentNumber: string;
  issueDate: string;
  warehouseCode: string;
  netAmount: number;
  igvAmount: number;
  totalAmount: number;
  status: string;
  notes?: string | null;
  responsible?: string | null;
  itemsCount: number;
  items: Array<{
    id: string;
    sku: string;
    description: string;
    quantity: number;
    unitCost: number;
    subtotal: number;
    igvAmount: number;
    totalAmount: number;
  }>;
}

export const inventoryPurchasesApi = {
  createPurchase: async (payload: CreateNationalPurchasePayload): Promise<NationalPurchaseRecord> => {
    const response = await apiClient.post<NationalPurchaseRecord>('/inventory/purchases', payload);
    return response.data;
  },

  listPurchases: async (): Promise<{ total: number; items: NationalPurchaseRecord[] }> => {
    const response = await apiClient.get<{ total: number; items: NationalPurchaseRecord[] }>('/inventory/purchases');
    return response.data;
  },

  getPurchaseById: async (id: string): Promise<NationalPurchaseRecord> => {
    const response = await apiClient.get<NationalPurchaseRecord>(`/inventory/purchases/${id}`);
    return response.data;
  },
};

