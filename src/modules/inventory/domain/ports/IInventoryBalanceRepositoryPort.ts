import { InventoryBalanceEntity } from '../entities/inventoryBalanceEntity';

export const INVENTORY_BALANCE_REPOSITORY_PORT = Symbol('INVENTORY_BALANCE_REPOSITORY_PORT');

export interface IInventoryBalanceRepositoryPort {
  findByWarehouseAndProduct(
    warehouseId: string,
    productId: string,
    companyId: string,
  ): Promise<InventoryBalanceEntity | null>;
  upsertBalance(balance: InventoryBalanceEntity): Promise<InventoryBalanceEntity>;
  findAllByCompany(companyId: string): Promise<
    (InventoryBalanceEntity & {
      sku: string;
      productDescription: string;
      warehouseCode: string;
    })[]
  >;
}

