import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { CustomsModule } from '../customs/customsModule';
import { InventoryStocksController } from './infrastructure/controllers/inventoryStocksController';
import { InventoryMovementsController } from './infrastructure/controllers/inventoryMovementsController';
import { InventoryPleController } from './infrastructure/controllers/inventoryPleController';

// Use Cases
import { ProcessImportCostOrderUseCase } from './application/use-cases/processImportCostOrderUseCase';
import { RegisterManualMovementUseCase } from './application/use-cases/registerManualMovementUseCase';
import { GetProductKardexLedgerUseCase } from './application/use-cases/getProductKardexLedgerUseCase';
import { ListWarehouseStockUseCase } from './application/use-cases/listWarehouseStockUseCase';
import { EvaluateBookObligationUseCase } from './application/use-cases/evaluateBookObligationUseCase';
import { GeneratePleBookUseCase } from './application/use-cases/generatePleBookUseCase';

// Event Listeners
import { ImportCostApprovedEventListener } from './application/listeners/importCostApprovedEventListener';

// Ports & Persistence
import { INVENTORY_WAREHOUSE_REPOSITORY_PORT } from './domain/ports/IInventoryWarehouseRepositoryPort';
import { INVENTORY_PRODUCT_REPOSITORY_PORT } from './domain/ports/IInventoryProductRepositoryPort';
import { INVENTORY_BALANCE_REPOSITORY_PORT } from './domain/ports/IInventoryBalanceRepositoryPort';
import { INVENTORY_MOVEMENT_REPOSITORY_PORT } from './domain/ports/IInventoryMovementRepositoryPort';
import { INVENTORY_OBLIGATION_REPOSITORY_PORT } from './domain/ports/IInventoryObligationRepositoryPort';

import { PrismaInventoryWarehouseRepository } from './infrastructure/persistence/prismaInventoryWarehouseRepository';
import { PrismaInventoryProductRepository } from './infrastructure/persistence/prismaInventoryProductRepository';
import { PrismaInventoryBalanceRepository } from './infrastructure/persistence/prismaInventoryBalanceRepository';
import { PrismaInventoryMovementRepository } from './infrastructure/persistence/prismaInventoryMovementRepository';
import { PrismaInventoryObligationRepository } from './infrastructure/persistence/prismaInventoryObligationRepository';

// Adapters
import { PleStructureValidatorService } from './infrastructure/adapters/pleStructureValidatorService';
import { Ple12_1FlatFileWriterAdapter } from './infrastructure/adapters/ple12_1FlatFileWriterAdapter';
import { Ple13_1FlatFileWriterAdapter } from './infrastructure/adapters/ple13_1FlatFileWriterAdapter';

@Module({
  imports: [AuthModule, CustomsModule],
  controllers: [
    InventoryStocksController,
    InventoryMovementsController,
    InventoryPleController,
  ],
  providers: [
    // Use Cases
    ProcessImportCostOrderUseCase,
    RegisterManualMovementUseCase,
    GetProductKardexLedgerUseCase,
    ListWarehouseStockUseCase,
    EvaluateBookObligationUseCase,
    GeneratePleBookUseCase,

    // Listeners
    ImportCostApprovedEventListener,

    // Adapters
    PleStructureValidatorService,
    Ple12_1FlatFileWriterAdapter,
    Ple13_1FlatFileWriterAdapter,

    // Repositories
    PrismaInventoryWarehouseRepository,
    {
      provide: INVENTORY_WAREHOUSE_REPOSITORY_PORT,
      useClass: PrismaInventoryWarehouseRepository,
    },
    PrismaInventoryProductRepository,
    {
      provide: INVENTORY_PRODUCT_REPOSITORY_PORT,
      useClass: PrismaInventoryProductRepository,
    },
    PrismaInventoryBalanceRepository,
    {
      provide: INVENTORY_BALANCE_REPOSITORY_PORT,
      useClass: PrismaInventoryBalanceRepository,
    },
    PrismaInventoryMovementRepository,
    {
      provide: INVENTORY_MOVEMENT_REPOSITORY_PORT,
      useClass: PrismaInventoryMovementRepository,
    },
    PrismaInventoryObligationRepository,
    {
      provide: INVENTORY_OBLIGATION_REPOSITORY_PORT,
      useClass: PrismaInventoryObligationRepository,
    },
  ],
  exports: [
    ProcessImportCostOrderUseCase,
    RegisterManualMovementUseCase,
    GetProductKardexLedgerUseCase,
    ListWarehouseStockUseCase,
    EvaluateBookObligationUseCase,
    GeneratePleBookUseCase,
    INVENTORY_WAREHOUSE_REPOSITORY_PORT,
    INVENTORY_PRODUCT_REPOSITORY_PORT,
    INVENTORY_BALANCE_REPOSITORY_PORT,
    INVENTORY_MOVEMENT_REPOSITORY_PORT,
    INVENTORY_OBLIGATION_REPOSITORY_PORT,
  ],
})
export class InventoryModule {}

