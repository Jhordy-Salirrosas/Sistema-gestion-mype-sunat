import { apiClient } from '@/lib/axios';

export interface ImportOrderItemPayload {
  productCode?: string;
  description: string;
  hsCode?: string;
  quantity: number;
  unitPriceFob: number;
  unitCode?: string;
}

export interface CreateImportOrderPayload {
  orderNumber?: string;
  supplierName: string;
  supplierCountry?: string;
  supplierTaxId?: string;
  supplierAddress?: string;
  supplierCondition?: string;
  isRelated?: boolean;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierId?: string;
  incoterm?: string;
  currencyCode?: string;
  issueDate?: string;
  expectedArrivalDate?: string;
  portOfOrigin?: string;
  portOfDestination?: string;
  transportMode?: string;
  estimatedFreight?: number;
  estimatedInsurance?: number;
  proformaNumber?: string;
  notes?: string;
  responsible?: string;
  items: ImportOrderItemPayload[];
}

export interface AdvanceStagePayload {
  nextStageIndex: number;
  stageName: string;
  userName: string;
  evidenceNotes?: string;
  documentUrl?: string;
  documentType?: string;
  documentNumber?: string;
  fileName?: string;
  fileHash?: string;
}

export interface AddOrderDocumentPayload {
  stageIndex: number;
  stageName: string;
  documentType: string;
  documentNumber: string;
  fileName: string;
  storageUrl: string;
  fileHash?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  isMandatory?: boolean;
  uploadedBy?: string;
}

export interface GenerateShipmentPayload {
  customsBrokerId?: string;
  originCountryCode?: string;
  destinationCustoms?: string;
  etdDate?: string;
  etaDate?: string;
}

export interface ImportOrderDocumentRecord {
  id: string;
  orderId: string;
  stageIndex: number;
  stageName: string;
  documentType: string;
  documentNumber: string;
  fileName: string;
  storageUrl: string;
  fileHash?: string | null;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  isMandatory: boolean;
  isVerified: boolean;
  uploadedBy?: string | null;
  createdAt: string;
}

export interface StageChecklistItem {
  stageIndex: number;
  stageName: string;
  mandatoryDocType: string;
  mandatoryDocLabel: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
  documents: Array<{
    id: string;
    documentType: string;
    documentNumber: string;
    fileName: string;
    storageUrl: string;
    fileHash?: string | null;
    isVerified: boolean;
    createdAt: string;
  }>;
}

export interface ImportOrderRecord {
  id: string;
  orderNumber: string;
  supplierName: string;
  supplierCountry: string;
  supplierTaxId?: string | null;
  supplierAddress?: string | null;
  supplierCondition?: string | null;
  isRelated?: boolean;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierId?: string | null;
  incoterm: string;
  currencyCode: string;
  issueDate: string;
  expectedArrivalDate?: string | null;
  portOfOrigin?: string | null;
  portOfDestination?: string | null;
  transportMode: string;
  totalFob: number;
  estimatedFreight: number;
  estimatedInsurance: number;
  totalCif: number;
  currentStage: string;
  currentStageIndex: number;
  status: string;
  proformaNumber?: string | null;
  notes?: string | null;
  responsible?: string | null;
  shipment?: { id: string; shipment_number: string; status: string } | null;
  declarations?: Array<{ id: string; dua_number: string; channel: string; status: string }> | null;
  goodsReceipts?: Array<{ id: string; receipt_number: string; status: string }> | null;
  items: Array<{
    id: string;
    productCode?: string | null;
    description: string;
    hsCode?: string | null;
    quantity: number;
    unitPriceFob: number;
    totalFob: number;
    unitCode: string;
  }>;
  stages: Array<{
    id: string;
    stageIndex: number;
    stageName: string;
    status: string;
    transitionDate: string;
    userName: string;
    evidenceNotes?: string | null;
    documentUrl?: string | null;
  }>;
  documents?: ImportOrderDocumentRecord[];
}

export const importOrdersApi = {
  listOrders: async (query?: { status?: string; search?: string }): Promise<{ total: number; items: ImportOrderRecord[] }> => {
    const response = await apiClient.get<{ total: number; items: ImportOrderRecord[] }>('/customs/orders', {
      params: query,
    });
    return response.data;
  },

  getOrderById: async (id: string): Promise<ImportOrderRecord> => {
    const response = await apiClient.get<ImportOrderRecord>(`/customs/orders/${id}`);
    return response.data;
  },

  createOrder: async (payload: CreateImportOrderPayload): Promise<ImportOrderRecord> => {
    const response = await apiClient.post<ImportOrderRecord>('/customs/orders', payload);
    return response.data;
  },

  advanceStage: async (id: string, payload: AdvanceStagePayload): Promise<ImportOrderRecord> => {
    const response = await apiClient.post<ImportOrderRecord>(`/customs/orders/${id}/advance-stage`, payload);
    return response.data;
  },

  addDocument: async (id: string, payload: AddOrderDocumentPayload): Promise<ImportOrderDocumentRecord> => {
    const response = await apiClient.post<ImportOrderDocumentRecord>(`/customs/orders/${id}/documents`, payload);
    return response.data;
  },

  listDocuments: async (id: string): Promise<ImportOrderDocumentRecord[]> => {
    const response = await apiClient.get<ImportOrderDocumentRecord[]>(`/customs/orders/${id}/documents`);
    return response.data;
  },

  getChecklist: async (id: string): Promise<StageChecklistItem[]> => {
    const response = await apiClient.get<StageChecklistItem[]>(`/customs/orders/${id}/checklist`);
    return response.data;
  },

  generateShipment: async (id: string, payload?: GenerateShipmentPayload): Promise<any> => {
    const response = await apiClient.post(`/customs/orders/${id}/generate-shipment`, payload || {});
    return response.data;
  },
};
