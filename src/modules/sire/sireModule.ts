import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { SireController } from './infrastructure/controllers/sireController';
import { ReconcileSireUseCase } from './application/use-cases/reconcileSireUseCase';

@Module({
  imports: [AuthModule],
  controllers: [SireController],
  providers: [ReconcileSireUseCase],
  exports: [ReconcileSireUseCase],
})
export class SireModule {}
