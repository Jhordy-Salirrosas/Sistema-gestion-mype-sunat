export type GoodsReceiptStatusType = 'CONFORME' | 'CON_DISCREPANCIA' | 'OBSERVADO';
export type ReceptionType = 'TOTAL' | 'PARCIAL';
export type SeriesDestinationType = 'MERCADERIA' | 'ACTIVO_FIJO';

export interface GoodsReceiptItemRecord {
  id?: string;
  goodsReceiptId?: string;
  customsItemId?: string;
  productCode: string;
  commercialDescription: string;
  declaredQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  differenceQuantity: number;
  discrepancyReason?: string;
  unitCode: string;
  destinationType: SeriesDestinationType;
}

export interface GoodsReceiptRecord {
  id: string;
  receiptNumber: string;
  declarationId: string;
  shipmentId?: string | null;
  warehouseCode: string;
  receptionDate: string;
  receptionType: ReceptionType;
  responsibleName: string;
  responsibleDni?: string | null;
  containerNumber?: string | null;
  sealNumber?: string | null;
  status: GoodsReceiptStatusType;
  observations?: string | null;
  items: GoodsReceiptItemRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ConfirmGoodsReceiptPayload {
  receiptNumber: string;
  declarationId: string;
  shipmentId?: string;
  warehouseCode?: string;
  responsibleName: string;
  responsibleDni?: string;
  containerNumber?: string;
  sealNumber?: string;
  receptionType?: ReceptionType;
  observations?: string;
  items: Array<{
    customsItemId?: string;
    productCode: string;
    commercialDescription: string;
    declaredQuantity: number;
    receivedQuantity: number;
    damagedQuantity?: number;
    discrepancyReason?: string;
    unitCode?: string;
    destinationType?: SeriesDestinationType;
  }>;
}

