import { ShipmentStatus } from '../enums/shipmentStatus.enum';

export interface CreateShipmentData {
  companyId: string;
  shipmentNumber: string; // EXP-2026-0001
  supplierId?: string;
  customsBrokerId?: string;
  incoterm?: string;
  currencyCode?: string;
  transportMode?: string;
  originCountryCode?: string;
  destinationCustoms?: string;
  etdDate?: Date | null;
  etaDate?: Date | null;
  orderReference?: string | null;
}

export interface AddDocumentData {
  shipmentId: string;
  documentType: string;
  documentNumber: string;
  issueDate: Date;
  issuerName?: string | null;
  storageUrl: string;
  vuceDrNumber?: string | null;
}

export interface AddEventData {
  shipmentId: string;
  eventType: string;
  eventTimestamp: Date;
  eventValue?: string | null;
  referenceCode?: string | null;
  registeredBy: string;
}

export interface ShipmentFilterOptions {
  companyId: string;
  status?: ShipmentStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export const CUSTOMS_SHIPMENT_REPOSITORY_PORT = Symbol('CUSTOMS_SHIPMENT_REPOSITORY_PORT');

export interface ICustomsShipmentRepositoryPort {
  createShipment(data: CreateShipmentData): Promise<any>;
  updateShipmentStatus(id: string, companyId: string, status: ShipmentStatus): Promise<any>;
  findShipmentById(id: string, companyId: string): Promise<any | null>;
  findShipmentByNumber(shipmentNumber: string, companyId: string): Promise<any | null>;
  listShipments(options: ShipmentFilterOptions): Promise<{ data: any[]; total: number }>;
  addDocument(data: AddDocumentData): Promise<any>;
  addEvent(data: AddEventData): Promise<any>;
  getShipmentEvents(shipmentId: string): Promise<any[]>;
  getShipmentDocuments(shipmentId: string): Promise<any[]>;
}
