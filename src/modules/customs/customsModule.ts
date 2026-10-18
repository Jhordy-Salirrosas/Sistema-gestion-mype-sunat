import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { CustomsController } from './infrastructure/controllers/customsController';
import { CustomsShipmentController } from './infrastructure/controllers/customsShipmentController';
import { CustomsSettlementController } from './infrastructure/controllers/customsSettlementController';
import { LandedCostController } from './infrastructure/controllers/landedCostController';

// Use Cases
import {
  CalculateDuaUseCase,
  RegisterDuaUseCase,
  GetCustomsDeclarationByIdUseCase,
  ListCustomsDeclarationsUseCase,
  ListKardexMovementsUseCase,
  CreateShipmentUseCase,
  ListShipmentsUseCase,
  GetShipmentByIdUseCase,
  AddShipmentDocumentUseCase,
  AddShipmentEventUseCase,
  RegisterDuaWizardUseCase,
  PaySettlementUseCase,
  AddLocalExpenseUseCase,
  CalculateLandedCostUseCase,
  ApplyLandedCostToKardexUseCase,
} from './application/use-cases';

// Ports & Repositories
import { CUSTOMS_REPOSITORY_PORT } from './domain/ports/customsRepositoryPort';
import { CUSTOMS_SHIPMENT_REPOSITORY_PORT } from './domain/ports/customsShipmentRepositoryPort';
import { CUSTOMS_SETTLEMENT_REPOSITORY_PORT } from './domain/ports/customsSettlementRepositoryPort';
import { LANDED_COST_REPOSITORY_PORT } from './domain/ports/landedCostRepositoryPort';

import { PrismaCustomsRepository } from './infrastructure/persistence/prismaCustomsRepository';
import { PrismaCustomsShipmentRepository } from './infrastructure/persistence/prismaCustomsShipmentRepository';
import { PrismaCustomsSettlementRepository } from './infrastructure/persistence/prismaCustomsSettlementRepository';
import { PrismaLandedCostRepository } from './infrastructure/persistence/prismaLandedCostRepository';

@Module({
  imports: [AuthModule],
  controllers: [
    CustomsController,
    CustomsShipmentController,
    CustomsSettlementController,
    LandedCostController,
  ],
  providers: [
    // Use Cases
    CalculateDuaUseCase,
    RegisterDuaUseCase,
    GetCustomsDeclarationByIdUseCase,
    ListCustomsDeclarationsUseCase,
    ListKardexMovementsUseCase,
    CreateShipmentUseCase,
    ListShipmentsUseCase,
    GetShipmentByIdUseCase,
    AddShipmentDocumentUseCase,
    AddShipmentEventUseCase,
    RegisterDuaWizardUseCase,
    PaySettlementUseCase,
    AddLocalExpenseUseCase,
    CalculateLandedCostUseCase,
    ApplyLandedCostToKardexUseCase,

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
  ],
  exports: [
    CUSTOMS_REPOSITORY_PORT,
    CUSTOMS_SHIPMENT_REPOSITORY_PORT,
    CUSTOMS_SETTLEMENT_REPOSITORY_PORT,
    LANDED_COST_REPOSITORY_PORT,
    CreateShipmentUseCase,
    ListShipmentsUseCase,
    GetShipmentByIdUseCase,
    AddShipmentDocumentUseCase,
    AddShipmentEventUseCase,
    RegisterDuaWizardUseCase,
    PaySettlementUseCase,
    AddLocalExpenseUseCase,
    CalculateLandedCostUseCase,
    ApplyLandedCostToKardexUseCase,
    CalculateDuaUseCase,
    RegisterDuaUseCase,
    GetCustomsDeclarationByIdUseCase,
    ListCustomsDeclarationsUseCase,
    ListKardexMovementsUseCase,
  ],
})
export class CustomsModule {}
