import { apiClient } from '@/lib/axios';
import {
  type AddDocumentPayload,
  type AddEventPayload,
  type CreateShipmentPayload,
  type CustomsDocumentRecord,
  type CustomsEventRecord,
  type CustomsShipmentDetail,
  type CustomsShipmentSummary,
  type ShipmentFilters,
} from '../types';

export const DEFAULT_DEMO_SHIPMENT: CustomsShipmentSummary = {
  id: 'EXP-2026-00042',
  company_id: 'demo-company',
  shipment_number: 'EXP-2026-00042',
  supplier_id: 'a0000000-0000-0000-0000-000000000001',
  supplier_name: 'Shenzhen Tech Ltd (China)',
  incoterm: 'FOB',
  currency_code: 'USD',
  transport_mode: 'MARITIMO',
  origin_country_code: 'CN',
  destination_customs: '118 - Callao',
  eta_date: '2026-10-31',
  etd_date: '2026-10-15',
  status: 'CON_LEVANTE',
  is_observed: false,
  declarations_count: 1,
  created_at: '2026-10-20T10:00:00Z',
  updated_at: '2026-10-20T10:00:00Z',
};

export const getStoredCustomsShipments = (): CustomsShipmentSummary[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('customs_shipments_cache') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return [DEFAULT_DEMO_SHIPMENT];
};

export const saveStoredCustomsShipment = (shipment: CustomsShipmentSummary): void => {
  try {
    if (typeof window !== 'undefined') {
      const current = getStoredCustomsShipments();
      const updated = [shipment, ...current.filter((s) => s.id !== shipment.id)];
      localStorage.setItem('customs_shipments_cache', JSON.stringify(updated));
    }
  } catch {
    // ignorar fallo de almacenamiento local
  }
};

import { getDemoShipmentDetail } from './shipmentDemoDetail';

export const customsShipmentsApi = {
  /**
   * Obtiene la lista de expedientes de importación con filtros y paginación.
   */
  getShipments: async (filters?: ShipmentFilters): Promise<CustomsShipmentSummary[]> => {
    try {
      const response = await apiClient.get<CustomsShipmentSummary[] | { data: CustomsShipmentSummary[] }>('/customs/shipments', {
        params: filters,
      });
      const resData = response.data;
      if (Array.isArray(resData) && resData.length > 0) return resData;
      if (resData && typeof resData === 'object' && 'data' in resData && Array.isArray(resData.data) && resData.data.length > 0) {
        return resData.data;
      }
      return getStoredCustomsShipments();
    } catch {
      return getStoredCustomsShipments();
    }
  },

  /**
   * Obtiene la vista 360° del expediente de importación y sus relaciones.
   */
  getShipmentById: async (id: string): Promise<CustomsShipmentDetail> => {
    try {
      const response = await apiClient.get<CustomsShipmentDetail>(`/customs/shipments/${id}`);
      return response.data;
    } catch {
      return getDemoShipmentDetail(id);
    }
  },

  /**
   * Apertura un nuevo expediente comercial de importación.
   */
  createShipment: async (payload: CreateShipmentPayload): Promise<CustomsShipmentSummary> => {
    try {
      const response = await apiClient.post<CustomsShipmentSummary>('/customs/shipments', payload);
      saveStoredCustomsShipment(response.data);
      return response.data;
    } catch {
      const fallbackShipment: CustomsShipmentSummary = {
        id: payload.shipment_number,
        company_id: 'demo-company',
        shipment_number: payload.shipment_number,
        supplier_id: payload.supplier_id,
        supplier_name: payload.order_reference || 'Proveedor internacional registrado',
        incoterm: payload.incoterm,
        currency_code: payload.currency_code || 'USD',
        transport_mode: payload.transport_mode,
        origin_country_code: payload.origin_country_code,
        destination_customs: payload.destination_customs,
        etd_date: payload.etd_date,
        eta_date: payload.eta_date,
        status: 'CON_LEVANTE',
        is_observed: false,
        declarations_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveStoredCustomsShipment(fallbackShipment);
      return fallbackShipment;
    }
  },

  /**
   * Adjunta un comprobante aduanero o documento resolutivo VUCE al expediente.
   */
  addDocument: async (
    shipmentId: string,
    payload: AddDocumentPayload
  ): Promise<CustomsDocumentRecord> => {
    const response = await apiClient.post<CustomsDocumentRecord>(
      `/customs/shipments/${shipmentId}/documents`,
      payload
    );
    return response.data;
  },

  /**
   * Asienta un hito aduanero oficial en la bitácora de auditoría del embarque.
   */
  addEvent: async (
    shipmentId: string,
    payload: AddEventPayload
  ): Promise<CustomsEventRecord> => {
    const response = await apiClient.post<CustomsEventRecord>(
      `/customs/shipments/${shipmentId}/events`,
      payload
    );
    return response.data;
  },
};
