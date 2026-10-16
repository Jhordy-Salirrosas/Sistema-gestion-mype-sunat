import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { CustomsController } from './infrastructure/controllers/customsController';
import { CalculateDuaUseCase } from './application/use-cases/calculateDuaUseCase';
import { RegisterDuaUseCase } from './application/use-cases/registerDuaUseCase';
import { GetCustomsDeclarationByIdUseCase } from './application/use-cases/getCustomsDeclarationByIdUseCase';
import { ListCustomsDeclarationsUseCase } from './application/use-cases/listCustomsDeclarationsUseCase';
import { ListKardexMovementsUseCase } from './application/use-cases/listKardexMovementsUseCase';
import { CUSTOMS_REPOSITORY_PORT } from './domain/ports/customsRepositoryPort';
import { PrismaCustomsRepository } from './infrastructure/persistence/prismaCustomsRepository';

@Module({
  imports: [AuthModule],
  controllers: [CustomsController],
  providers: [
    CalculateDuaUseCase,
    RegisterDuaUseCase,
    GetCustomsDeclarationByIdUseCase,
    ListCustomsDeclarationsUseCase,
    ListKardexMovementsUseCase,
    PrismaCustomsRepository,
    {
      provide: CUSTOMS_REPOSITORY_PORT,
      useClass: PrismaCustomsRepository,
    },
  ],
  exports: [
    CUSTOMS_REPOSITORY_PORT,
    CalculateDuaUseCase,
    RegisterDuaUseCase,
    GetCustomsDeclarationByIdUseCase,
    ListCustomsDeclarationsUseCase,
    ListKardexMovementsUseCase,
  ],
})
export class CustomsModule {}
