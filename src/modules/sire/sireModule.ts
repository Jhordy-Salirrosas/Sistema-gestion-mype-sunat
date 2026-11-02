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
import { ResilienceStateModule } from '../resilience/application/resilienceStateModule';
import { SireDashboardMetricsService } from './application/sireDashboardMetricsService';
import { SireDashboardMetricsRepository } from './infrastructure/persistence/sireDashboardMetricsRepository';
import {
  LegacySireMetricsController,
  SireDashboardMetricsController,
  SireMetricsCompatibilityController,
  SireResilienceMetricsCompatibilityController,
} from './infrastructure/controllers/sireDashboardMetricsController';
import { UploadSireReportUseCase } from './application/use-cases/uploadSireReportUseCase';
import { SireReportFileParser } from './infrastructure/parsers/sireReportFileParser';
import { GetSireProposalUseCase } from './application/use-cases/getSireProposalUseCase';
import { ExcludeSireRecordUseCase } from './application/use-cases/excludeSireRecordUseCase';
import { ReplaceSireProposalUseCase } from './application/use-cases/replaceSireProposalUseCase';
import { RegisterSirePreliminaryUseCase } from './application/use-cases/registerSirePreliminaryUseCase';
import { DeleteSirePreliminaryUseCase } from './application/use-cases/deleteSirePreliminaryUseCase';
import { GenerateSireRecordUseCase } from './application/use-cases/generateSireRecordUseCase';
import { SireTicketManagerService } from './application/sireTicketManagerService';
import { SIRE_SUNAT_GATEWAY } from './domain/ports/sireSunatGatewayPort';
import { UnsupportedSireSunatGateway } from './infrastructure/sunat/unsupportedSireSunatGateway';
import { MockSireSunatGateway } from './infrastructure/sunat/mockSireSunatGateway';
import { AcceptSireProposalUseCase } from './application/use-cases/acceptSireProposalUseCase';
import { RestoreSireRecordUseCase } from './application/use-cases/restoreSireRecordUseCase';

@Module({
  imports: [AuthModule, ResilienceStateModule],
  controllers: [
    SireDashboardMetricsController,
    SireMetricsCompatibilityController,
    SireResilienceMetricsCompatibilityController,
    LegacySireMetricsController,
    SireController,
  ],
  providers: [
    ReconcileSireUseCase,
    IngestSireProposalUseCase,
    ExportSireProposalUseCase,
    GetReconciliationHistoryUseCase,
    CloseFiscalPeriodUseCase,
    SireDashboardMetricsService,
    SireDashboardMetricsRepository,
    UploadSireReportUseCase,
    SireReportFileParser,
    GetSireProposalUseCase,
    ExcludeSireRecordUseCase,
    ReplaceSireProposalUseCase,
    RegisterSirePreliminaryUseCase,
    DeleteSirePreliminaryUseCase,
    GenerateSireRecordUseCase,
    SireTicketManagerService,
    AcceptSireProposalUseCase,
    RestoreSireRecordUseCase,
    PrismaSireRepository,
    SireTxtParserAdapter,
    SireTxtWriterAdapter,
    UnsupportedSireSunatGateway,
    {
      provide: SIRE_REPOSITORY_PORT,
      useClass: PrismaSireRepository,
    },
    { provide: SIRE_PARSER_PORT, useExisting: SireTxtParserAdapter },
    { provide: SIRE_EXPORTER_PORT, useExisting: SireTxtWriterAdapter },
    MockSireSunatGateway,
    {
      provide: SIRE_SUNAT_GATEWAY,
      inject: [MockSireSunatGateway, UnsupportedSireSunatGateway],
      useFactory: (
        mockGateway: MockSireSunatGateway,
        unsupportedGateway: UnsupportedSireSunatGateway,
      ) =>
        process.env['SUNAT_SIRE_ENV']?.toLowerCase() === 'mock'
          ? mockGateway
          : unsupportedGateway,
    },
  ],
  exports: [SIRE_REPOSITORY_PORT, ReconcileSireUseCase],
})
export class SireModule {}
