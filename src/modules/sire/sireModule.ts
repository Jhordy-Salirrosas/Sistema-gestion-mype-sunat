import { Module } from '@nestjs/common';
import { SireController } from './infrastructure/controllers/sireController';
import { ReconcileSireUseCase } from './application/use-cases/reconcileSireUseCase';

@Module({
  controllers: [SireController],
  providers: [ReconcileSireUseCase],
  exports: [ReconcileSireUseCase],
})
export class SireModule {}
