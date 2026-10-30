import { LandedCostStatus } from '../enums/landedCostStatus.enum';

export interface CreateLocalExpenseData {
  shipmentId: string;
  supplierRuc: string;
  supplierName: string;
  expenseConcept: string; // ALMACENAJE, AGENCIA, TRANSPORTE_LOCAL...
  invoiceSerialNumber: string;
  issueDate: Date;
  netAmountPen: number;
  igvAmountPen: number;
  totalAmountPen: number;
  spotDetractionRate?: number;
  isCapitalizable?: boolean;
  prorationMethod: string; // PESO_BRUTO, VALOR_FOB, UNIDADES
}

export interface SaveLandedCostSheetData {
  shipmentId: string;
  totalCifPen: number;
  totalDutiesPen: number;
  totalLocalExpensesPen: number;
  totalInventoryCostPen: number;
  status?: LandedCostStatus;
  approvedByAccountant?: boolean;
  itemsProration: Array<{
    itemId: string;
    allocatedLocalCostPen: number;
    finalLandedCostUnitPen: number;
  }>;
}

export const LANDED_COST_REPOSITORY_PORT = Symbol('LANDED_COST_REPOSITORY_PORT');

export interface ILandedCostRepositoryPort {
  addLocalExpense(data: CreateLocalExpenseData): Promise<any>;
  findLocalExpensesByShipmentId(shipmentId: string, companyId?: string): Promise<any[]>;
  deleteLocalExpense(expenseId: string): Promise<void>;
  saveLandedCostSheet(data: SaveLandedCostSheetData): Promise<any>;
  findLandedCostSheetByShipmentId(shipmentId: string, companyId?: string): Promise<any | null>;
}
