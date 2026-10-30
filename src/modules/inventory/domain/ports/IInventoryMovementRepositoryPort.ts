import { InventoryMovementEntity } from '../entities/inventoryMovementEntity';

export const INVENTORY_MOVEMENT_REPOSITORY_PORT = Symbol('INVENTORY_MOVEMENT_REPOSITORY_PORT');

export interface IInventoryMovementRepositoryPort {
  create(movement: InventoryMovementEntity): Promise<InventoryMovementEntity>;
  findBySourceReference(
    sourceReferenceId: string,
    operationTypeCode: string,
    productId: string,
    companyId: string,
  ): Promise<InventoryMovementEntity | null>;
  findMovementsByProduct(
    productId: string,
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<InventoryMovementEntity[]>;
  findAllByCompany(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<
    (InventoryMovementEntity & {
      sku: string;
      productDescription: string;
      warehouseCode: string;
    })[]
  >;
}

