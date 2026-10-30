import { SeriesDestinationType } from './customsItemEntity';

export type LandedCostSheetStatus =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'APROBADO'
  | 'A_AJUSTAR'
  | 'PROVISIONAL'
  | 'DEFINITIVO'
  | 'A_RECALCULAR';

export interface LandedCostItemProps {
  id?: string;
  landedCostSheetId?: string;
  customsItemId?: string | null;
  productCode: string;
  commercialDescription: string;
  quantity: number;
  fobUnitUsd: number;
  fobTotalUsd: number;
  grossWeightKg?: number | null;
  allocatedFreightPen?: number;
  allocatedInsurancePen?: number;
  allocatedCifPen: number;
  allocatedDutiesPen: number;
  allocatedLocalExpensesPen?: number;
  totalLandedCostPen: number;
  unitLandedCostPen: number;
  destinationType?: SeriesDestinationType;
}

export class LandedCostItemEntity {
  constructor(private readonly props: LandedCostItemProps) {}

  get id(): string | undefined {
    return this.props.id;
  }

  get productCode(): string {
    return this.props.productCode;
  }

  get commercialDescription(): string {
    return this.props.commercialDescription;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get fobTotalUsd(): number {
    return this.props.fobTotalUsd;
  }

  get allocatedCifPen(): number {
    return this.props.allocatedCifPen;
  }

  get allocatedDutiesPen(): number {
    return this.props.allocatedDutiesPen;
  }

  get allocatedLocalExpensesPen(): number {
    return this.props.allocatedLocalExpensesPen ?? 0;
  }

  get totalLandedCostPen(): number {
    return this.props.totalLandedCostPen;
  }

  get unitLandedCostPen(): number {
    return this.props.unitLandedCostPen;
  }

  get destinationType(): SeriesDestinationType {
    return this.props.destinationType ?? 'MERCADERIA';
  }

  get isMercaderia(): boolean {
    return this.destinationType === 'MERCADERIA';
  }

  get isActivoFijo(): boolean {
    return this.destinationType === 'ACTIVO_FIJO';
  }

  toPrimitives(): LandedCostItemProps {
    return { ...this.props };
  }
}

export interface LandedCostSheetProps {
  id?: string;
  companyId?: string;
  shipmentId: string;
  declarationId?: string | null;
  calculationDate?: Date;
  version?: number;
  fobTotalUsd?: number;
  freightTotalUsd?: number;
  insuranceTotalUsd?: number;
  exchangeRate?: number;
  totalCifPen: number;
  totalDutiesPen: number;
  totalLocalExpensesPen: number;
  totalInventoryCostPen: number;
  status?: LandedCostSheetStatus;
  approvedByAccountant?: boolean;
  approvedAt?: Date | null;
  itemsProration?: LandedCostItemEntity[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class LandedCostSheetEntity {
  private readonly items: LandedCostItemEntity[];

  constructor(private readonly props: LandedCostSheetProps) {
    this.items = props.itemsProration ? [...props.itemsProration] : [];
    this.props.version = props.version ?? 1;
    this.props.status = props.status ?? 'BORRADOR';
    this.props.calculationDate = props.calculationDate ?? new Date();
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get companyId(): string | undefined {
    return this.props.companyId;
  }

  get shipmentId(): string {
    return this.props.shipmentId;
  }

  get declarationId(): string | null | undefined {
    return this.props.declarationId;
  }

  get version(): number {
    return this.props.version!;
  }

  get status(): LandedCostSheetStatus {
    return this.props.status!;
  }

  get totalCifPen(): number {
    return this.props.totalCifPen;
  }

  get totalDutiesPen(): number {
    return this.props.totalDutiesPen;
  }

  get totalLocalExpensesPen(): number {
    return this.props.totalLocalExpensesPen;
  }

  get totalInventoryCostPen(): number {
    return this.props.totalInventoryCostPen;
  }

  get isApproved(): boolean {
    return (
      this.props.status === 'APROBADO' ||
      this.props.status === 'DEFINITIVO' ||
      !!this.props.approvedByAccountant
    );
  }

  get itemsProration(): LandedCostItemEntity[] {
    return [...this.items];
  }

  approve(accountantApproval: boolean = true): void {
    if (this.isApproved) {
      throw new Error('La hoja de costos ya fue aprobada.');
    }
    this.props.status = 'APROBADO';
    this.props.approvedByAccountant = accountantApproval;
    this.props.approvedAt = new Date();
  }

  markForAdjustment(): void {
    this.props.status = 'A_AJUSTAR';
  }

  getCommercialCostItems(): LandedCostItemEntity[] {
    return this.items.filter((it) => it.isMercaderia);
  }

  getFixedAssetCostItems(): LandedCostItemEntity[] {
    return this.items.filter((it) => it.isActivoFijo);
  }

  toPrimitives(): LandedCostSheetProps {
    return {
      ...this.props,
      itemsProration: this.items.map((i) => i.toPrimitives() as any),
    };
  }
}

