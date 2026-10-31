import { SeriesDestinationType } from './customsItemEntity';

export type GoodsReceiptStatusType = 'CONFORME' | 'CON_DISCREPANCIA' | 'OBSERVADO';
export type ReceptionType = 'TOTAL' | 'PARCIAL';

export interface GoodsReceiptItemProps {
  id?: string;
  goodsReceiptId?: string;
  customsItemId?: string | null;
  productCode: string;
  commercialDescription: string;
  declaredQuantity: number;
  receivedQuantity: number;
  damagedQuantity?: number;
  differenceQuantity?: number;
  discrepancyReason?: string | null;
  unitCode?: string;
  destinationType?: SeriesDestinationType;
}

export class GoodsReceiptItemEntity {
  constructor(private readonly props: GoodsReceiptItemProps) {
    if (this.props.declaredQuantity < 0 || this.props.receivedQuantity < 0) {
      throw new Error('Las cantidades declaradas o recibidas no pueden ser negativas.');
    }
    const damaged = this.props.damagedQuantity ?? 0;
    const diff = Number((this.props.receivedQuantity - this.props.declaredQuantity).toFixed(4));
    this.props.differenceQuantity = diff;
    this.props.damagedQuantity = damaged;
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get productCode(): string {
    return this.props.productCode;
  }

  get commercialDescription(): string {
    return this.props.commercialDescription;
  }

  get declaredQuantity(): number {
    return this.props.declaredQuantity;
  }

  get receivedQuantity(): number {
    return this.props.receivedQuantity;
  }

  get damagedQuantity(): number {
    return this.props.damagedQuantity ?? 0;
  }

  get differenceQuantity(): number {
    return this.props.differenceQuantity ?? 0;
  }

  get discrepancyReason(): string | null | undefined {
    return this.props.discrepancyReason;
  }

  get unitCode(): string {
    return this.props.unitCode ?? 'NIU';
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

  toPrimitives(): GoodsReceiptItemProps {
    return { ...this.props };
  }
}

export interface GoodsReceiptProps {
  id?: string;
  companyId: string;
  receiptNumber: string;
  declarationId: string;
  shipmentId?: string | null;
  warehouseCode?: string;
  receptionDate?: Date;
  receptionType?: ReceptionType;
  responsibleName: string;
  responsibleDni?: string | null;
  containerNumber?: string | null;
  sealNumber?: string | null;
  status?: GoodsReceiptStatusType;
  observations?: string | null;
  items?: GoodsReceiptItemEntity[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class GoodsReceiptEntity {
  private readonly itemsList: GoodsReceiptItemEntity[];

  constructor(private readonly props: GoodsReceiptProps) {
    this.itemsList = props.items ? [...props.items] : [];
    this.props.warehouseCode = props.warehouseCode ?? 'ALM-01';
    this.props.receptionDate = props.receptionDate ?? new Date();
    this.props.receptionType = props.receptionType ?? 'TOTAL';

    // Auto-determinar estado si no se especifica explícitamente
    if (!props.status) {
      this.props.status = this.hasDiscrepancies() ? 'CON_DISCREPANCIA' : 'CONFORME';
    }
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get receiptNumber(): string {
    return this.props.receiptNumber;
  }

  get declarationId(): string {
    return this.props.declarationId;
  }

  get shipmentId(): string | null | undefined {
    return this.props.shipmentId;
  }

  get warehouseCode(): string {
    return this.props.warehouseCode!;
  }

  get receptionDate(): Date {
    return this.props.receptionDate!;
  }

  get receptionType(): ReceptionType {
    return this.props.receptionType!;
  }

  get responsibleName(): string {
    return this.props.responsibleName;
  }

  get status(): GoodsReceiptStatusType {
    return this.props.status!;
  }

  get items(): GoodsReceiptItemEntity[] {
    return [...this.itemsList];
  }

  hasDiscrepancies(): boolean {
    return this.itemsList.some(
      (item) => item.differenceQuantity !== 0 || item.damagedQuantity > 0,
    );
  }

  getCommercialConformingItems(): GoodsReceiptItemEntity[] {
    return this.itemsList.filter((item) => item.isMercaderia);
  }

  getFixedAssetConformingItems(): GoodsReceiptItemEntity[] {
    return this.itemsList.filter((item) => item.isActivoFijo);
  }

  toPrimitives(): GoodsReceiptProps {
    return {
      ...this.props,
      items: this.itemsList.map((i) => i.toPrimitives() as any),
    };
  }
}

