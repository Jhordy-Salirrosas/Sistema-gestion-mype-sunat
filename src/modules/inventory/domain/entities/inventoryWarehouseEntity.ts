export interface InventoryWarehouseProps {
  id?: string;
  companyId: string;
  warehouseCode: string;
  sunatEstablishmentCode?: string;
  description: string;
  address?: string | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class InventoryWarehouseEntity {
  readonly id?: string;
  readonly companyId: string;
  readonly warehouseCode: string;
  readonly sunatEstablishmentCode: string;
  readonly description: string;
  readonly address?: string | null;
  readonly isActive: boolean;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;

  constructor(props: InventoryWarehouseProps) {
    if (!props.companyId) throw new Error('companyId requerido para el almacén.');
    if (!props.warehouseCode) throw new Error('warehouseCode requerido.');
    if (!props.description) throw new Error('Descripción de almacén requerida.');

    this.id = props.id;
    this.companyId = props.companyId;
    this.warehouseCode = props.warehouseCode.trim().toUpperCase();
    this.sunatEstablishmentCode = (props.sunatEstablishmentCode || '0000').padStart(4, '0');
    this.description = props.description.trim();
    this.address = props.address ?? null;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}

