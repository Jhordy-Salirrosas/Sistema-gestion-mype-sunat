/**
 * Tipos para la gestión de Expedientes de Importación (Customs Shipments),
 * documentos probatorios VUCE y bitácora de eventos legales.
 */

export type ShipmentStatus =
  | 'BORRADOR'
  | 'EN_TRANSITO'
  | 'ARRIBADO'
  | 'EN_DESPACHO'
  | 'CON_LEVANTE'
  | 'COSTEADO'
  | 'CERRADO'
  | 'CANCELADO';

import { type CustomsDeclarationRecord } from './customsDeclaration.types';

export type TransportMode = 'MARITIMO' | 'AEREO' | 'TERRESTRE' | 'FLUVIAL';

export type IncotermCode =
  | 'EXW'
  | 'FCA'
  | 'FAS'
  | 'FOB'
  | 'CFR'
  | 'CIF'
  | 'CPT'
  | 'CIP'
  | 'DAP'
  | 'DPU'
  | 'DDP';

export type CustomsDocumentType =
  | 'FAC' // Factura comercial
  | 'TRA' // B/L o Guía Aérea
  | 'SEG' // Póliza de seguro
  | 'CRO' // Certificado de origen
  | 'AUT' // Documento Resolutivo VUCE
  | 'DAV' // Declaración Andina del Valor
  | 'PDF' // Copia de la DAM
  | 'OTR'; // Otros documentos

export type CustomsEventType =
  | 'EMBARQUE'
  | 'LLEGADA_MEDIO_TRANSPORTE'
  | 'TERMINO_DESCARGA'
  | 'NUMERACION_DAM'
  | 'CANAL_ASIGNADO'
  | 'REVISION_DOCUMENTARIA'
  | 'DILIGENCIA_CONFORME'
  | 'PAGO_TRIBUTOS'
  | 'LEVANTE'
  | 'RETIRO_MERCANCIA'
  | 'REGULARIZACION'
  | 'LEGAJAMIENTO';

export interface ForeignSupplierSummary {
  id: string;
  business_name: string;
  country_code: string;
  tax_id?: string;
  is_related?: boolean;
}

export interface CustomsBrokerSummary {
  id: string;
  broker_code: string;
  business_name: string;
  jurisdiction?: string;
  mandate_active: boolean;
}

export interface CustomsDocumentRecord {
  id: string;
  shipment_id: string;
  document_type: CustomsDocumentType;
  document_number: string;
  issue_date: string;
  issuer_name?: string;
  storage_url?: string;
  is_validated: boolean;
  vuce_dr_number?: string;
  created_at: string;
}

export interface CustomsEventRecord {
  id: string;
  shipment_id: string;
  event_type: CustomsEventType;
  event_timestamp: string;
  event_value?: string;
  reference_code?: string;
  registered_by: string;
  created_at: string;
}

export interface CustomsShipmentSummary {
  id: string;
  company_id: string;
  shipment_number: string;
  supplier_id: string;
  supplier_name?: string;
  incoterm: IncotermCode;
  currency_code: string;
  transport_mode: TransportMode;
  origin_country_code: string;
  destination_customs: string;
  customs_broker_id?: string;
  broker_name?: string;
  etd_date?: string;
  eta_date?: string;
  status: ShipmentStatus;
  is_observed: boolean;
  declarations_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CustomsShipmentDetail extends CustomsShipmentSummary {
  supplier?: ForeignSupplierSummary;
  customs_broker?: CustomsBrokerSummary;
  order_reference?: string;
  documents: CustomsDocumentRecord[];
  events: CustomsEventRecord[];
  declarations?: CustomsDeclarationRecord[];
  local_expenses?: unknown[];
}

export interface CreateShipmentPayload {
  shipment_number: string;
  supplier_id: string;
  incoterm: IncotermCode;
  currency_code?: string;
  transport_mode: TransportMode;
  origin_country_code: string;
  destination_customs: string;
  customs_broker_id?: string;
  etd_date?: string;
  eta_date?: string;
  order_reference?: string;
}

export interface AddDocumentPayload {
  document_type: CustomsDocumentType;
  document_number: string;
  issue_date: string;
  issuer_name?: string;
  storage_url?: string;
  vuce_dr_number?: string;
}

export interface AddEventPayload {
  event_type: CustomsEventType;
  event_timestamp: string;
  event_value?: string;
  reference_code?: string;
  registered_by?: string;
}

export interface ShipmentFilters {
  status?: ShipmentStatus;
  search?: string;
  incoterm?: IncotermCode;
  customs_code?: string;
  page?: number;
  limit?: number;
}
