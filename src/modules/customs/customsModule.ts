import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { CustomsController } from './infrastructure/controllers/customsController';
import { CustomsShipmentController } from './infrastructure/controllers/customsShipmentController';
import { CustomsSettlementController } from './infrastructure/controllers/customsSettlementController';
import { LandedCostController } from './infrastructure/controllers/landedCostController';
import { GoodsReceiptController } from './infrastructure/controllers/goodsReceiptController';
import { CustomsSirePurchasesController } from './infrastructure/controllers/customsSirePurchasesController';

// Use Cases
import {
  CalculateDuaUseCase,
  RegisterDuaUseCase,
  GetCustomsDeclarationByIdUseCase,
  ListCustomsDeclarationsUseCase,
  CreateShipmentUseCase,
  ListShipmentsUseCase,
  GetShipmentByIdUseCase,
  AddShipmentDocumentUseCase,
  AddShipmentEventUseCase,
  RegisterDuaWizardUseCase,
  PaySettlementUseCase,
  AddLocalExpenseUseCase,
  CalculateLandedCostUseCase,
  ConfirmGoodsReceiptUseCase,
  ApproveLandedCostSheetUseCase,
  AdjustLateImportCostUseCase,
  SimulateDamTaxesUseCase,
} from './application/use-cases';

// Ports & Repositories
import { CUSTOMS_REPOSITORY_PORT } from './domain/ports/customsRepositoryPort';
import { CUSTOMS_SHIPMENT_REPOSITORY_PORT } from './domain/ports/customsShipmentRepositoryPort';
import { CUSTOMS_SETTLEMENT_REPOSITORY_PORT } from './domain/ports/customsSettlementRepositoryPort';
import { LANDED_COST_REPOSITORY_PORT } from './domain/ports/landedCostRepositoryPort';
import { GOODS_RECEIPT_REPOSITORY_PORT } from './domain/ports/goodsReceiptRepositoryPort';
import { CUSTOMS_EVENT_PUBLISHER_PORT } from './domain/ports/customsEventPublisherPort';

import { PrismaCustomsRepository } from './infrastructure/persistence/prismaCustomsRepository';
import { PrismaCustomsShipmentRepository } from './infrastructure/persistence/prismaCustomsShipmentRepository';
import { PrismaCustomsSettlementRepository } from './infrastructure/persistence/prismaCustomsSettlementRepository';
import { PrismaLandedCostRepository } from './infrastructure/persistence/prismaLandedCostRepository';
import { PrismaGoodsReceiptRepository } from './infrastructure/persistence/prismaGoodsReceiptRepository';
import { NestCustomsEventPublisherAdapter } from './infrastructure/adapters/nestCustomsEventPublisherAdapter';

@Module({
  imports: [AuthModule],
  controllers: [
    CustomsController,
    CustomsShipmentController,
    CustomsSettlementController,
    LandedCostController,
    GoodsReceiptController,
    CustomsSirePurchasesController,
  ],
  providers: [
    // Use Cases
    CalculateDuaUseCase,
    RegisterDuaUseCase,
    GetCustomsDeclarationByIdUseCase,
    ListCustomsDeclarationsUseCase,
    CreateShipmentUseCase,
    ListShipmentsUseCase,
    GetShipmentByIdUseCase,
    AddShipmentDocumentUseCase,
    AddShipmentEventUseCase,
    RegisterDuaWizardUseCase,
    PaySettlementUseCase,
    AddLocalExpenseUseCase,
    CalculateLandedCostUseCase,
    ConfirmGoodsReceiptUseCase,
    ApproveLandedCostSheetUseCase,
    AdjustLateImportCostUseCase,
    SimulateDamTaxesUseCase,

    // Repositories & Ports
    PrismaCustomsRepository,
    {
      provide: CUSTOMS_REPOSITORY_PORT,
      useClass: PrismaCustomsRepository,
    },
    PrismaCustomsShipmentRepository,
    {
      provide: CUSTOMS_SHIPMENT_REPOSITORY_PORT,
      useClass: PrismaCustomsShipmentRepository,
    },
    PrismaCustomsSettlementRepository,
    {
      provide: CUSTOMS_SETTLEMENT_REPOSITORY_PORT,
      useClass: PrismaCustomsSettlementRepository,
    },
    PrismaLandedCostRepository,
    {
      provide: LANDED_COST_REPOSITORY_PORT,
      useClass: PrismaLandedCostRepository,
    },
    PrismaGoodsReceiptRepository,
    {
      provide: GOODS_RECEIPT_REPOSITORY_PORT,
      useClass: PrismaGoodsReceiptRepository,
    },
    NestCustomsEventPublisherAdapter,
    {
      provide: CUSTOMS_EVENT_PUBLISHER_PORT,
      useClass: NestCustomsEventPublisherAdapter,
    },
  ],
  exports: [
    CUSTOMS_REPOSITORY_PORT,
    CUSTOMS_SHIPMENT_REPOSITORY_PORT,
    CUSTOMS_SETTLEMENT_REPOSITORY_PORT,
    LANDED_COST_REPOSITORY_PORT,
    GOODS_RECEIPT_REPOSITORY_PORT,
    CUSTOMS_EVENT_PUBLISHER_PORT,
    CreateShipmentUseCase,
    ListShipmentsUseCase,
    GetShipmentByIdUseCase,
    AddShipmentDocumentUseCase,
    AddShipmentEventUseCase,
    RegisterDuaWizardUseCase,
    PaySettlementUseCase,
    AddLocalExpenseUseCase,
    CalculateLandedCostUseCase,
    CalculateDuaUseCase,
    RegisterDuaUseCase,
    GetCustomsDeclarationByIdUseCase,
    ListCustomsDeclarationsUseCase,
    ConfirmGoodsReceiptUseCase,
    ApproveLandedCostSheetUseCase,
    AdjustLateImportCostUseCase,
    SimulateDamTaxesUseCase,
  ],
})
export class CustomsModule {}
