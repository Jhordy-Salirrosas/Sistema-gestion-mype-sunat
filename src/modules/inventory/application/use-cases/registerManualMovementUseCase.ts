import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INVENTORY_WAREHOUSE_REPOSITORY_PORT,
  type IInventoryWarehouseRepositoryPort,
} from '../../domain/ports/IInventoryWarehouseRepositoryPort';
import {
  INVENTORY_PRODUCT_REPOSITORY_PORT,
  type IInventoryProductRepositoryPort,
} from '../../domain/ports/IInventoryProductRepositoryPort';
import {
  INVENTORY_BALANCE_REPOSITORY_PORT,
  type IInventoryBalanceRepositoryPort,
} from '../../domain/ports/IInventoryBalanceRepositoryPort';
import {
  INVENTORY_MOVEMENT_REPOSITORY_PORT,
  type IInventoryMovementRepositoryPort,
} from '../../domain/ports/IInventoryMovementRepositoryPort';
import { RegisterManualMovementDto } from '../dto/registerManualMovementDto';
import { MovingWeightedAverageEngine } from '../../domain/rules/MovingWeightedAverageEngine';
import { InventoryMovementEntity } from '../../domain/entities/inventoryMovementEntity';
import { InventoryBalanceEntity } from '../../domain/entities/inventoryBalanceEntity';

@Injectable()
export class RegisterManualMovementUseCase {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY_PORT)
    private readonly warehouseRepository: IInventoryWarehouseRepositoryPort,
    @Inject(INVENTORY_PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: IInventoryProductRepositoryPort,
    @Inject(INVENTORY_BALANCE_REPOSITORY_PORT)
    private readonly balanceRepository: IInventoryBalanceRepositoryPort,
    @Inject(INVENTORY_MOVEMENT_REPOSITORY_PORT)
    private readonly movementRepository: IInventoryMovementRepositoryPort,
  ) {}

  async execute(dto: RegisterManualMovementDto, companyId: string) {
    if (!companyId) throw new BadRequestException('company_id requerido.');

    const warehouse = dto.warehouse_code
      ? (await this.warehouseRepository.findByCode(dto.warehouse_code, companyId)) ||
        (await this.warehouseRepository.ensureDefaultWarehouse(companyId))
      : await this.warehouseRepository.ensureDefaultWarehouse(companyId);

    const product = await this.productRepository.findBySku(dto.sku, companyId);
    if (!product) {
      throw new NotFoundException(`El producto con SKU "${dto.sku}" no existe.`);
    }

    const balance = await this.balanceRepository.findByWarehouseAndProduct(
      warehouse.id!,
      product.id!,
      companyId,
    );

    const prevStock = balance?.currentStock ?? 0;
    const prevAvgCost = balance?.averageUnitCost ?? 0;
    const prevTotalVal = balance?.totalInventoryValue ?? 0;

    let calculation;
    try {
      calculation = MovingWeightedAverageEngine.calculate({
        previousStock: prevStock,
        previousAverageCost: prevAvgCost,
        previousTotalValue: prevTotalVal,
        movementDirection: dto.direction,
        quantity: dto.quantity,
        unitCost: dto.unit_cost,
      });
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    const movementNumber = `MOV-${Date.now().toString().slice(-6)}-${dto.sku.replace(/\s+/g, '')}`;
    const movDate = dto.movement_date ? new Date(dto.movement_date) : new Date();

    const movement = new InventoryMovementEntity({
      companyId,
      warehouseId: warehouse.id!,
      productId: product.id!,
      movementNumber,
      movementDate: movDate,
      operationTypeCode: dto.operation_type_code,
      documentTypeCode: dto.document_type_code,
      documentSerial: dto.document_serial,
      documentNumber: dto.document_number,
      direction: dto.direction,
      quantity: calculation.movementQuantity,
      unitCost: calculation.movementUnitCost,
      totalCost: calculation.movementTotalCost,
      previousStock: prevStock,
      previousUnitCost: prevAvgCost,
      previousTotalValue: prevTotalVal,
      resultingStock: calculation.resultingStock,
      resultingUnitCost: calculation.resultingAverageCost,
      resultingTotalValue: calculation.resultingTotalValue,
      notes: dto.notes,
    });

    const savedMovement = await this.movementRepository.create(movement);

    await this.balanceRepository.upsertBalance(
      new InventoryBalanceEntity({
        id: balance?.id,
        companyId,
        warehouseId: warehouse.id!,
        productId: product.id!,
        currentStock: calculation.resultingStock,
        averageUnitCost: calculation.resultingAverageCost,
        totalInventoryValue: calculation.resultingTotalValue,
        lastMovementAt: movDate,
      }),
    );

    return {
      movementId: savedMovement.id,
      movementNumber: savedMovement.movementNumber,
      sku: product.sku,
      direction: savedMovement.direction,
      quantity: savedMovement.quantity,
      unitCost: savedMovement.unitCost,
      totalCost: savedMovement.totalCost,
      resultingStock: savedMovement.resultingStock,
      resultingAverageCost: savedMovement.resultingUnitCost,
      resultingTotalValue: savedMovement.resultingTotalValue,
    };
  }
}

