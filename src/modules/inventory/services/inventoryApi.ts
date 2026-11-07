import { apiClient } from '@/lib/axios';
import {
  type StockSummaryResponse,
  type KardexLedgerResponse,
  type InventoryMovement,
  type InventoryBookObligation,
} from '../types/inventory.types';
import { type ProductFormData } from '../validators/productSchema';
import { type ManualMovementFormData } from '../validators/manualMovementSchema';
import { type PleEvaluationFormData, type PleExportFormData } from '../validators/pleExportSchema';

export const inventoryApi = {
  /**
   * Obtiene el resumen de existencias valorizadas multialmacén de la empresa directamente desde la BD.
   */
  getStockBalances: async (): Promise<StockSummaryResponse> => {
    const response = await apiClient.get<StockSummaryResponse>('/inventory/stocks');
    return response.data ?? { totalValuationPen: 0, totalItemsCount: 0, balances: [] };
  },

  /**
   * Registra un nuevo producto en el catálogo maestro y BD.
   */
  registerProduct: async (payload: ProductFormData) => {
    const response = await apiClient.post('/inventory/stocks/products', payload);
    return response.data;
  },

  /**
   * Obtiene la ficha técnica y detalle completo de un producto por SKU desde la BD.
   */
  getProductBySku: async (sku: string) => {
    const response = await apiClient.get(`/inventory/stocks/products/${encodeURIComponent(sku.trim())}`);
    return response.data;
  },

  /**
   * Actualiza los datos y ficha técnica de un producto por SKU en la BD.
   */
  updateProduct: async (sku: string, payload: Partial<ProductFormData>) => {
    const response = await apiClient.patch(
      `/inventory/stocks/products/${encodeURIComponent(sku.trim())}`,
      payload
    );
    return response.data;
  },

  /**
   * Elimina o inactiva un producto del catálogo de inventario con validación de Kardex.
   */
  deleteProduct: async (sku: string): Promise<{ action: 'DEACTIVATED' | 'DELETED'; message: string }> => {
    const response = await apiClient.delete(
      `/inventory/stocks/products/${encodeURIComponent(sku.trim())}`
    );
    return response.data;
  },

  /**
   * Obtiene el libro mayor de Kardex valorizado real para un producto específico desde la BD.
   */
  getKardexBySku: async (
    sku: string,
    params?: { start_date?: string; end_date?: string }
  ): Promise<KardexLedgerResponse> => {
    const response = await apiClient.get<KardexLedgerResponse>(
      `/inventory/stocks/kardex/${encodeURIComponent(sku.trim())}`,
      { params }
    );
    return response.data;
  },

  /**
   * Registra una entrada o salida manual de inventario en la BD.
   */
  createManualMovement: async (payload: ManualMovementFormData) => {
    const response = await apiClient.post('/inventory/movements', payload);
    return response.data;
  },

  /**
   * Lista el historial cronológico de movimientos reales de la empresa desde la BD.
   */
  listMovements: async (
    params?: { start_date?: string; end_date?: string }
  ): Promise<{ total: number; items: InventoryMovement[] }> => {
    const response = await apiClient.get<{ total: number; items: InventoryMovement[] }>(
      '/inventory/movements',
      { params }
    );
    return response.data ?? { total: 0, items: [] };
  },

  /**
   * Evalúa la obligatoriedad jurídica según Art. 35 Reglamento LIR en el backend.
   */
  evaluateObligation: async (
    payload: PleEvaluationFormData
  ): Promise<InventoryBookObligation> => {
    const response = await apiClient.post<InventoryBookObligation>(
      '/inventory/ple/evaluate',
      payload
    );
    return response.data;
  },

  /**
   * Consulta la evaluación de obligatoriedad guardada para un año fiscal en la BD.
   */
  getObligationByYear: async (
    year: number
  ): Promise<InventoryBookObligation | null> => {
    try {
      const response = await apiClient.get<InventoryBookObligation | null>(
        `/inventory/ple/obligation/${year}`
      );
      return response.data;
    } catch {
      return null;
    }
  },

  /**
   * Descarga el archivo plano de Libro Electrónico PLE 12.1 o 13.1 generado por el backend.
   */
  exportPleBook: async (
    payload: PleExportFormData
  ): Promise<{ blob: Blob; fileName: string; recordsCount: number }> => {
    const response = await apiClient.post('/inventory/ple/export', payload, {
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    const fileName = match
      ? match[1]
      : `LE${payload.fiscal_year}00${payload.book_type === '12.1' ? '120100' : '130100'}001111.txt`;
    const recordsCount = Number(response.headers['x-records-count'] || 0);
    return {
      blob: response.data,
      fileName,
      recordsCount,
    };
  },
};
