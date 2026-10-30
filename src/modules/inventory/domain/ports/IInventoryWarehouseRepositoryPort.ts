import { InventoryWarehouseEntity } from '../entities/inventoryWarehouseEntity';

export const INVENTORY_WAREHOUSE_REPOSITORY_PORT = Symbol('INVENTORY_WAREHOUSE_REPOSITORY_PORT');

export interface IInventoryWarehouseRepositoryPort {
  create(warehouse: InventoryWarehouseEntity): Promise<InventoryWarehouseEntity>;
  findById(id: string, companyId: string): Promise<InventoryWarehouseEntity | null>;
  findByCode(warehouseCode: string, companyId: string): Promise<InventoryWarehouseEntity | null>;
  findAllByCompany(companyId: string): Promise<InventoryWarehouseEntity[]>;
  ensureDefaultWarehouse(companyId: string): Promise<InventoryWarehouseEntity>;
}

