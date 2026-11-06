/**
 * Contratos de integración del libro de inventario.
 *
 * Facturación, Importaciones, Compras e Inventario no escriben stock
 * directamente: emiten uno de estos eventos y `InventoryLedgerService` los
 * aplica de forma idempotente.
 *
 * Este archivo no depende de NestJS ni de Prisma: es el contrato compartido.
 */

export type StockSourceModule =
  | 'INVOICES'
  | 'CUSTOMS'
  | 'PURCHASES'
  | 'INVENTORY'
  | 'MIGRATION';

export interface StockLine {
  sku: string;
  description?: string;
  quantity: number;
  unitValue?: number;
  unitCost?: number;
  affectation?: string;
  isInventory?: boolean;
}

interface BaseStockEvent {
  companyId: string;
  sourceReferenceId: string;
  sourceModule: StockSourceModule;
  date: string;
  warehouseCode?: string;
  lines: StockLine[];
}

export interface SaleAcceptedEvent extends BaseStockEvent {
  type: 'SALE_ACCEPTED';
  invoiceId: string;
  documentType: '01' | '03';
  serie: string;
  correlativo: number;
}

export interface CreditNoteAcceptedEvent extends BaseStockEvent {
  type: 'CREDIT_NOTE_ACCEPTED';
  invoiceId: string;
  reasonCode: string;
  affectsStock: boolean;
}

export interface DebitNoteAcceptedEvent extends BaseStockEvent {
  type: 'DEBIT_NOTE_ACCEPTED';
  invoiceId: string;
  reasonCode: string;
  affectsStock: boolean;
}

export interface ImportGoodsReceivedEvent extends BaseStockEvent {
  type: 'IMPORT_GOODS_RECEIVED';
  importOrderId: string;
  goodsReceiptId: string;
}

export interface ImportCostApprovedEvent extends BaseStockEvent {
  type: 'IMPORT_COST_APPROVED';
  importOrderId: string;
  landedCostSheetId: string;
}

export interface PurchaseConfirmedEvent extends BaseStockEvent {
  type: 'PURCHASE_CONFIRMED';
  purchaseInvoiceId: string;
  supplierId: string;
}

export interface TransferConfirmedEvent extends BaseStockEvent {
  type: 'TRANSFER_CONFIRMED';
  transferId: string;
  fromWarehouseCode: string;
  toWarehouseCode: string;
}

export interface AdjustmentApprovedEvent extends BaseStockEvent {
  type: 'ADJUSTMENT_APPROVED';
  adjustmentId: string;
  direction: 'ENTRADA' | 'SALIDA';
  reason: string;
}

export type StockEvent =
  | SaleAcceptedEvent
  | CreditNoteAcceptedEvent
  | DebitNoteAcceptedEvent
  | ImportGoodsReceivedEvent
  | ImportCostApprovedEvent
  | PurchaseConfirmedEvent
  | TransferConfirmedEvent
  | AdjustmentApprovedEvent;

export interface StockMovementResult {
  movementId: string;
  sku: string;
  direction: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost: number;
  resultingStock: number;
  resultingAverageCost: number;
  resultingTotalValue: number;
}

export interface AccountingPostingRequested {
  companyId: string;
  sourceModule: StockSourceModule;
  sourceReferenceId: string;
  processCode: string;
  date: string;
  lines: Array<{
    roleCode: string;
    accountCode?: string;
    debit: number;
    credit: number;
  }>;
}
