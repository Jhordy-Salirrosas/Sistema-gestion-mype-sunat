import { apiClient } from '@/lib/axios';
import {
  type CalculateDuaPayload,
  type CustomsDeclarationDetail,
  type CustomsDeclarationSummary,
  type DuaCalculationResult,
  type KardexMovementRecord,
  type RegisterDuaPayload,
} from '../types/customs.types';
import {
  normalizeDeclarationDetail,
  normalizeDeclarationSummary,
  normalizeKardexRecord,
} from '../lib/customsNormalizer';

export const customsApi = {
  /**
   * Simula la liquidación tributaria ante la SUNAT en tiempo real.
   */
  calculateDua: async (payload: CalculateDuaPayload): Promise<DuaCalculationResult> => {
    const response = await apiClient.post<DuaCalculationResult>('/customs/calculate', payload);
    return response.data;
  },

  /**
   * Registra definitivamente la DAM y detona la afectación transaccional al Kardex.
   */
  registerDua: async (payload: RegisterDuaPayload): Promise<CustomsDeclarationDetail> => {
    const response = await apiClient.post<Record<string, unknown>>('/customs/declarations', payload);
    return normalizeDeclarationDetail(response.data);
  },

  /**
   * Obtiene el historial de declaraciones de la empresa autenticada.
   */
  getDeclarations: async (): Promise<CustomsDeclarationSummary[]> => {
    const response = await apiClient.get<Record<string, unknown>[]>('/customs/declarations');
    const list = Array.isArray(response.data) ? response.data : [];
    return list.map(normalizeDeclarationSummary);
  },

  /**
   * Obtiene el detalle completo y series arancelarias de una DAM por su ID.
   */
  getDeclarationById: async (id: string): Promise<CustomsDeclarationDetail> => {
    const response = await apiClient.get<Record<string, unknown>>(`/customs/declarations/${id}`);
    return normalizeDeclarationDetail(response.data);
  },

  /**
   * Obtiene los movimientos valorizados de inventario permanente (Kardex).
   */
  getKardexMovements: async (): Promise<KardexMovementRecord[]> => {
    const response = await apiClient.get<Record<string, unknown>[]>('/customs/kardex');
    const list = Array.isArray(response.data) ? response.data : [];
    return list.map(normalizeKardexRecord);
  },
};
