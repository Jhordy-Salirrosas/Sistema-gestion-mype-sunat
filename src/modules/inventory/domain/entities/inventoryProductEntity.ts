import { SunatTable5VO } from '../value-objects/sunatTable5Vo';
import { SunatTable6VO } from '../value-objects/sunatTable6Vo';

export interface InventoryProductProps {
  id?: string;
  companyId: string;
  sku: string;
  description: string;
  sunatTypeCode?: string;
  sunatUnitCode?: string;
  minStockAlert?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class InventoryProductEntity {
  readonly id?: string;
  readonly companyId: string;
  readonly sku: string;
  readonly description: string;
  readonly sunatTypeCode: string;
  readonly sunatUnitCode: string;
  readonly minStockAlert: number;
  readonly isActive: boolean;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;

  constructor(props: InventoryProductProps) {
    if (!props.companyId) throw new Error('companyId requerido para el producto.');
    if (!props.sku) throw new Error('SKU requerido.');
    if (!props.description) throw new Error('Descripción de producto requerida.');

    this.id = props.id;
    this.companyId = props.companyId;
    this.sku = props.sku.trim();
    this.description = props.description.trim();
    this.sunatTypeCode = new SunatTable5VO(props.sunatTypeCode || '01').code;
    this.sunatUnitCode = new SunatTable6VO(props.sunatUnitCode || 'NIU').code;
    this.minStockAlert = Math.max(0, props.minStockAlert ?? 0);
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}

