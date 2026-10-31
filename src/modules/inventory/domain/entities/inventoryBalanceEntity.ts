export interface InventoryBalanceProps {
  id?: string;
  companyId: string;
  warehouseId: string;
  productId: string;
  currentStock: number;
  averageUnitCost: number;
  totalInventoryValue: number;
  lastMovementAt?: Date | null;
  updatedAt?: Date;
}

export class InventoryBalanceEntity {
  readonly id?: string;
  readonly companyId: string;
  readonly warehouseId: string;
  readonly productId: string;
  readonly currentStock: number;
  readonly averageUnitCost: number;
  readonly totalInventoryValue: number;
  readonly lastMovementAt?: Date | null;
  readonly updatedAt?: Date;

  constructor(props: InventoryBalanceProps) {
    if (!props.companyId) throw new Error('companyId requerido para el balance.');
    if (!props.warehouseId) throw new Error('warehouseId requerido.');
    if (!props.productId) throw new Error('productId requerido.');

    this.id = props.id;
    this.companyId = props.companyId;
    this.warehouseId = props.warehouseId;
    this.productId = props.productId;
    this.currentStock = Number(props.currentStock ?? 0);
    this.averageUnitCost = Number(props.averageUnitCost ?? 0);
    this.totalInventoryValue = Number(props.totalInventoryValue ?? 0);
    this.lastMovementAt = props.lastMovementAt ?? null;
    this.updatedAt = props.updatedAt;
  }
}

