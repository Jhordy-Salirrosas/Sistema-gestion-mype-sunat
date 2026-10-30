import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { MovingWeightedAverageEngine } from '../../domain/rules/MovingWeightedAverageEngine';
import { InventoryMovementEntity } from '../../domain/entities/inventoryMovementEntity';
import { InventoryBalanceEntity } from '../../domain/entities/inventoryBalanceEntity';

export interface ImportCostOrderItem {
  sku: string;
  description: string;
  receivedQuantity: number;
  unitLandedCostPen: number;
  destinationType?: 'MERCADERIA' | 'ACTIVO_FIJO';
}

export interface ProcessImportCostOrderCommand {
  companyId: string;
  shipmentId: string;
  damNumber: string;
  warehouseCode?: string;
  items: ImportCostOrderItem[];
}

export interface ProcessImportCostOrderResult {
  processedMovements: number;
  skippedFixedAssets: number;
  alreadyProcessedCount: number;
  itemsSummary: { sku: string; quantity: number; resultingStock: number; unitCost: number }[];
}

@Injectable()
export class ProcessImportCostOrderUseCase {
  private readonly logger = new Logger(ProcessImportCostOrderUseCase.name);

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

  async execute(command: ProcessImportCostOrderCommand): Promise<ProcessImportCostOrderResult> {
    const { companyId, shipmentId, damNumber, items } = command;

    const warehouse = command.warehouseCode
      ? (await this.warehouseRepository.findByCode(command.warehouseCode, companyId)) ||
        (await this.warehouseRepository.ensureDefaultWarehouse(companyId))
      : await this.warehouseRepository.ensureDefaultWarehouse(companyId);

    let processedMovements = 0;
    let skippedFixedAssets = 0;
    let alreadyProcessedCount = 0;
    const itemsSummary: { sku: string; quantity: number; resultingStock: number; unitCost: number }[] = [];

    for (const item of items) {
      // 1. Descarte contable de Activos Fijos (NIC 16 no afecta existencias comerciales)
      if (item.destinationType === 'ACTIVO_FIJO') {
        skippedFixedAssets++;
        this.logger.log(`Ítem ${item.sku} clasificado como ACTIVO_FIJO. Omitido de Kardex comercial.`);
        continue;
      }

      // 2. Garantizar producto en catálogo
      const product = await this.productRepository.findOrCreateBySku(
        companyId,
        item.sku,
        item.description,
      );

      // 3. Control de Idempotencia estricto (Evita doble afectación por reintento de red)
      const existingMovement = await this.movementRepository.findBySourceReference(
        shipmentId,
        '18',
        product.id!,
        companyId,
      );

      if (existingMovement) {
        alreadyProcessedCount++;
        this.logger.warn(`Movimiento tipo 18 ya registrado para producto ${item.sku} en expediente ${shipmentId}.`);
        itemsSummary.push({
          sku: item.sku,
          quantity: item.receivedQuantity,
          resultingStock: existingMovement.resultingStock,
          unitCost: existingMovement.unitCost,
        });
        continue;
      }

      // 4. Obtener saldo previo
      const balance = await this.balanceRepository.findByWarehouseAndProduct(
        warehouse.id!,
        product.id!,
        companyId,
      );

      const prevStock = balance?.currentStock ?? 0;
      const prevAvgCost = balance?.averageUnitCost ?? 0;
      const prevTotalVal = balance?.totalInventoryValue ?? 0;

      // 5. Calcular CPP Perpetuo Móvil
      const calculation = MovingWeightedAverageEngine.calculate({
        previousStock: prevStock,
        previousAverageCost: prevAvgCost,
        previousTotalValue: prevTotalVal,
        movementDirection: 'ENTRADA',
        quantity: item.receivedQuantity,
        unitCost: item.unitLandedCostPen,
      });

      // 6. Generar número correlativo
      const movementNumber = `IMP-${Date.now().toString().slice(-6)}-${item.sku.replace(/\s+/g, '')}`;

      // 7. Persistir Movimiento
      const movementEntity = new InventoryMovementEntity({
        companyId,
        warehouseId: warehouse.id!,
        productId: product.id!,
        movementNumber,
        movementDate: new Date(),
        accountingDate: new Date(),
        operationTypeCode: '18', // Importación
        documentTypeCode: '50',  // DAM
        documentNumber: damNumber,
        direction: 'ENTRADA',
        quantity: calculation.movementQuantity,
        unitCost: calculation.movementUnitCost,
        totalCost: calculation.movementTotalCost,
        previousStock: prevStock,
        previousUnitCost: prevAvgCost,
        previousTotalValue: prevTotalVal,
        resultingStock: calculation.resultingStock,
        resultingUnitCost: calculation.resultingAverageCost,
        resultingTotalValue: calculation.resultingTotalValue,
        sourceReferenceId: shipmentId,
        notes: `Nacionalización DAM ${damNumber}`,
      });

      await this.movementRepository.create(movementEntity);

      // 8. Actualizar Saldo
      await this.balanceRepository.upsertBalance(
        new InventoryBalanceEntity({
          id: balance?.id,
          companyId,
          warehouseId: warehouse.id!,
          productId: product.id!,
          currentStock: calculation.resultingStock,
          averageUnitCost: calculation.resultingAverageCost,
          totalInventoryValue: calculation.resultingTotalValue,
          lastMovementAt: new Date(),
        }),
      );

      processedMovements++;
      itemsSummary.push({
        sku: item.sku,
        quantity: item.receivedQuantity,
        resultingStock: calculation.resultingStock,
        unitCost: item.unitLandedCostPen,
      });
    }

    return {
      processedMovements,
      skippedFixedAssets,
      alreadyProcessedCount,
      itemsSummary,
    };
  }
}

