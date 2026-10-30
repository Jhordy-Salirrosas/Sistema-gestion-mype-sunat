import { SeriesDestinationType } from '../entities/customsItemEntity';

export interface ImportCostItemPayload {
  productCode: string;
  commercialDescription: string;
  quantity: number;
  unitLandedCostPen: number;
  totalLandedCostPen: number;
  destinationType: SeriesDestinationType;
}

export interface ImportCostApprovedEventPayload {
  companyId: string;
  landedCostSheetId: string;
  version: number;
  shipmentId: string;
  declarationId?: string | null;
  approvedAt: Date;
  totalCifPen: number;
  totalDutiesPen: number;
  totalLocalExpensesPen: number;
  totalInventoryCostPen: number;
  costItems: ImportCostItemPayload[];
  occurredAt?: Date;
}

export class ImportCostApprovedEvent {
  public static readonly EVENT_NAME = 'customs.import_cost.approved';

  public readonly eventName = ImportCostApprovedEvent.EVENT_NAME;
  public readonly occurredAt: Date;

  constructor(public readonly payload: ImportCostApprovedEventPayload) {
    this.occurredAt = payload.occurredAt ?? new Date();
  }
}

