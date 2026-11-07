import { apiClient } from '@/lib/axios';
import {
  type ConfirmGoodsReceiptPayload,
  type GoodsReceiptRecord,
} from '../types';

export const goodsReceiptApi = {
  /**
   * Registra y confirma el Acta de Recepción Física en rampa de almacén.
   */
  confirmReceipt: async (payload: ConfirmGoodsReceiptPayload): Promise<GoodsReceiptRecord> => {
    const response = await apiClient.post<GoodsReceiptRecord>(
      '/customs/goods-receipt',
      payload
    );
    return response.data;
  },

  /**
   * Consulta los detalles de un acta de recepción y sus discrepancias físicas por ID.
   */
  getReceiptById: async (id: string): Promise<GoodsReceiptRecord> => {
    const response = await apiClient.get<GoodsReceiptRecord>(
      `/customs/goods-receipt/${id}`
    );
    return response.data;
  },

  /**
   * Lista las actas de recepción de la empresa con filtros opcionales.
   */
  listReceipts: async (params?: {
    declarationId?: string;
    status?: string;
  }): Promise<GoodsReceiptRecord[]> => {
    const response = await apiClient.get<GoodsReceiptRecord[]>(
      '/customs/goods-receipt',
      { params }
    );
    return Array.isArray(response.data) ? response.data : [];
  },
};

