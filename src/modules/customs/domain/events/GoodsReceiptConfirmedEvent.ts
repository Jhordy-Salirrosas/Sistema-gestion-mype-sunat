import { SeriesDestinationType } from '../entities/customsItemEntity';

export interface GoodsReceiptConfirmedEventPayload {
  companyId: string;
  goodsReceiptId: string;
  receiptNumber: string;
  declarationId: string;
  shipmentId?: string | null;
  warehouseCode: string;
  receptionDate: Date;
  status: 'CONFORME' | 'CON_DISCREPANCIA' | 'OBSERVADO';
  items: Array<{
    productCode: string;
    commercialDescription: string;
    declaredQuantity: number;
    receivedQuantity: number;
    damagedQuantity: number;
    unitCode: string;
    destinationType: SeriesDestinationType;
  }>;
  occurredAt?: Date;
}

export class GoodsReceiptConfirmedEvent {
  public static readonly EVENT_NAME = 'customs.goods_receipt.confirmed';

  public readonly eventName = GoodsReceiptConfirmedEvent.EVENT_NAME;
  public readonly occurredAt: Date;

  constructor(public readonly payload: GoodsReceiptConfirmedEventPayload) {
    this.occurredAt = payload.occurredAt ?? new Date();
  }
}

