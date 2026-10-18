import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { SireController } from './infrastructure/controllers/sireController';
import { ReconcileSireUseCase } from './application/use-cases/reconcileSireUseCase';
import { SIRE_REPOSITORY_PORT } from './domain/ports/sireRepositoryPort';
import { PrismaSireRepository } from './infrastructure/persistence/prismaSireRepository';
import { SIRE_PARSER_PORT } from './domain/ports/sireParserPort';
import { SIRE_EXPORTER_PORT } from './domain/ports/sireExporterPort';
import { SireTxtParserAdapter } from './infrastructure/parsers/sireTxtParserAdapter';
import { SireTxtWriterAdapter } from './infrastructure/parsers/sireTxtWriterAdapter';
import { IngestSireProposalUseCase } from './application/use-cases/ingestSireProposalUseCase';
import { ExportSireProposalUseCase } from './application/use-cases/exportSireProposalUseCase';
import { GetReconciliationHistoryUseCase } from './application/use-cases/getReconciliationHistoryUseCase';
import { CloseFiscalPeriodUseCase } from './application/use-cases/closeFiscalPeriodUseCase';

@Module({
  imports: [AuthModule],
  controllers: [SireController],
  providers: [
    ReconcileSireUseCase,
    IngestSireProposalUseCase,
    ExportSireProposalUseCase,
    GetReconciliationHistoryUseCase,
    CloseFiscalPeriodUseCase,
    PrismaSireRepository,
    SireTxtParserAdapter,
    SireTxtWriterAdapter,
    {
      provide: SIRE_REPOSITORY_PORT,
      useClass: PrismaSireRepository,
    },
    { provide: SIRE_PARSER_PORT, useExisting: SireTxtParserAdapter },
    { provide: SIRE_EXPORTER_PORT, useExisting: SireTxtWriterAdapter },
  ],
  exports: [SIRE_REPOSITORY_PORT, ReconcileSireUseCase],
})
export class SireModule {}
