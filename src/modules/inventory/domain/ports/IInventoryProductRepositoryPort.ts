import { InventoryProductEntity } from '../entities/inventoryProductEntity';

export const INVENTORY_PRODUCT_REPOSITORY_PORT = Symbol('INVENTORY_PRODUCT_REPOSITORY_PORT');

export interface IInventoryProductRepositoryPort {
  create(product: InventoryProductEntity): Promise<InventoryProductEntity>;
  findById(id: string, companyId: string): Promise<InventoryProductEntity | null>;
  findBySku(sku: string, companyId: string): Promise<InventoryProductEntity | null>;
  findAllByCompany(companyId: string): Promise<InventoryProductEntity[]>;
  findOrCreateBySku(
    companyId: string,
    sku: string,
    defaultDescription: string,
  ): Promise<InventoryProductEntity>;
}

