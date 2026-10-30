import { SunatTable12VO } from '../value-objects/sunatTable12Vo';
import { SunatTable10VO } from '../value-objects/sunatTable10Vo';

export interface InventoryMovementProps {
  id?: string;
  companyId: string;
  warehouseId: string;
  productId: string;
  movementNumber: string;
  movementDate: Date;
  accountingDate?: Date;
  operationTypeCode: string;
  documentTypeCode?: string | null;
  documentSerial?: string | null;
  documentNumber?: string | null;
  direction: 'ENTRADA' | 'SALIDA';
  quantity: number;
  unitCost: number;
  totalCost: number;
  previousStock: number;
  previousUnitCost: number;
  previousTotalValue: number;
  resultingStock: number;
  resultingUnitCost: number;
  resultingTotalValue: number;
  sourceReferenceId?: string | null;
  notes?: string | null;
  createdAt?: Date;
}

export class InventoryMovementEntity {
  readonly id?: string;
  readonly companyId: string;
  readonly warehouseId: string;
  readonly productId: string;
  readonly movementNumber: string;
  readonly movementDate: Date;
  readonly accountingDate: Date;
  readonly operationTypeCode: string;
  readonly documentTypeCode?: string | null;
  readonly documentSerial?: string | null;
  readonly documentNumber?: string | null;
  readonly direction: 'ENTRADA' | 'SALIDA';
  readonly quantity: number;
  readonly unitCost: number;
  readonly totalCost: number;
  readonly previousStock: number;
  readonly previousUnitCost: number;
  readonly previousTotalValue: number;
  readonly resultingStock: number;
  readonly resultingUnitCost: number;
  readonly resultingTotalValue: number;
  readonly sourceReferenceId?: string | null;
  readonly notes?: string | null;
  readonly createdAt?: Date;

  constructor(props: InventoryMovementProps) {
    if (!props.companyId) throw new Error('companyId requerido para el movimiento.');
    if (!props.warehouseId) throw new Error('warehouseId requerido.');
    if (!props.productId) throw new Error('productId requerido.');
    if (props.quantity <= 0) throw new Error('La cantidad debe ser estrictamente positiva.');

    this.id = props.id;
    this.companyId = props.companyId;
    this.warehouseId = props.warehouseId;
    this.productId = props.productId;
    this.movementNumber = props.movementNumber;
    this.movementDate = props.movementDate;
    this.accountingDate = props.accountingDate ?? props.movementDate;
    this.operationTypeCode = new SunatTable12VO(props.operationTypeCode).code;
    this.documentTypeCode = props.documentTypeCode
      ? new SunatTable10VO(props.documentTypeCode).code
      : null;
    this.documentSerial = props.documentSerial ?? null;
    this.documentNumber = props.documentNumber ?? null;
    this.direction = props.direction;
    this.quantity = props.quantity;
    this.unitCost = props.unitCost;
    this.totalCost = props.totalCost;
    this.previousStock = props.previousStock;
    this.previousUnitCost = props.previousUnitCost;
    this.previousTotalValue = props.previousTotalValue;
    this.resultingStock = props.resultingStock;
    this.resultingUnitCost = props.resultingUnitCost;
    this.resultingTotalValue = props.resultingTotalValue;
    this.sourceReferenceId = props.sourceReferenceId ?? null;
    this.notes = props.notes ?? null;
    this.createdAt = props.createdAt;
  }
}

