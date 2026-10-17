import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { SireController } from './infrastructure/controllers/sireController';
import { ReconcileSireUseCase } from './application/use-cases/reconcileSireUseCase';
import { SIRE_REPOSITORY_PORT } from './domain/ports/sireRepositoryPort';
import { PrismaSireRepository } from './infrastructure/persistence/prismaSireRepository';

@Module({
  imports: [AuthModule],
  controllers: [SireController],
  providers: [
    ReconcileSireUseCase,
    PrismaSireRepository,
    {
      provide: SIRE_REPOSITORY_PORT,
      useClass: PrismaSireRepository,
    },
  ],
  exports: [SIRE_REPOSITORY_PORT, ReconcileSireUseCase],
})
export class SireModule {}
