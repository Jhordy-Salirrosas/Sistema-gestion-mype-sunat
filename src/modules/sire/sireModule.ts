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
import { selectSireSunatGateway } from './infrastructure/sunat/sireGatewaySelector';
import { ManualSireConsultationController } from './infrastructure/controllers/manualSireConsultationController';
import { SimulateManualSireConsultationUseCase } from './application/use-cases/simulateManualSireConsultationUseCase';
import { SireReadOnlyPeriodsController } from './infrastructure/controllers/sireReadOnlyPeriodsController';
import { SireReadOnlyPeriodsClient } from './infrastructure/sunat/sireReadOnlyPeriodsClient';
import { QueueModule } from '../resilience/infrastructure/queue/queueModule';
import { SirePeriodsJobConsumer } from './infrastructure/queue/sirePeriodsJobConsumer';
import { SIRE_FILE_STORAGE_PORT } from './domain/ports/sireFileStoragePort';
import { SireMenuController } from './infrastructure/controllers/sireMenuController';
import { SireMenuRepository } from './infrastructure/persistence/sireMenuRepository';
import { SireImportJobConsumer } from './infrastructure/queue/sireImportJobConsumer';
import { ImportarPropuestaSireUseCase } from './application/use-cases/importarPropuestaSireUseCase';
import {
  ConciliarPeriodoSireUseCase,
  ConsultarImportacionSireUseCase,
} from './application/use-cases/conciliarPeriodoSireUseCase';
import { ObtenerResumenSireUseCase } from './application/use-cases/obtenerResumenSireUseCase';
import {
  ConsultarReporteSireUseCase,
  ReportarSireUseCase,
} from './application/use-cases/reportarSireUseCase';
import { ObtenerHistorialSireUseCase } from './application/use-cases/obtenerHistorialSireUseCase';
import { crearSireFileStorage } from './infrastructure/storage/sireFileStorageSelector';
import { SireConfigurationController } from './infrastructure/controllers/sireConfigurationController';
import { GuardarConfiguracionSireUseCase } from './application/use-cases/guardarConfiguracionSireUseCase';
import { ConsultarEstadoConfiguracionSireUseCase } from './application/use-cases/consultarEstadoConfiguracionSireUseCase';
import { SIRE_CONFIGURATION_REPOSITORY_PORT } from './domain/ports/sireConfigurationRepositoryPort';
import { PrismaSireConfigurationRepository } from './infrastructure/persistence/prismaSireConfigurationRepository';

@Module({
  imports: [AuthModule, QueueModule, ResilienceStateModule],
  controllers: [
    SireDashboardMetricsController,
    SireMetricsCompatibilityController,
    SireResilienceMetricsCompatibilityController,
    LegacySireMetricsController,
    SireController,
    ManualSireConsultationController,
    SireReadOnlyPeriodsController,
    SireMenuController,
    SireConfigurationController,
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
    SimulateManualSireConsultationUseCase,
    SireReadOnlyPeriodsClient,
    SirePeriodsJobConsumer,
    SireImportJobConsumer,
    SireMenuRepository,
    ImportarPropuestaSireUseCase,
    ConciliarPeriodoSireUseCase,
    ConsultarImportacionSireUseCase,
    ObtenerResumenSireUseCase,
    ReportarSireUseCase,
    ConsultarReporteSireUseCase,
    ObtenerHistorialSireUseCase,
    GuardarConfiguracionSireUseCase,
    ConsultarEstadoConfiguracionSireUseCase,
    PrismaSireConfigurationRepository,
    PrismaSireRepository,
    SireTxtParserAdapter,
    SireTxtWriterAdapter,
    UnsupportedSireSunatGateway,
    {
      provide: SIRE_REPOSITORY_PORT,
      useClass: PrismaSireRepository,
    },
    {
      /**
       * Las credenciales SIRE de la empresa se guardan cifradas: el
       * adaptador es el único punto que conoce el cifrado.
       */
      provide: SIRE_CONFIGURATION_REPOSITORY_PORT,
      useExisting: PrismaSireConfigurationRepository,
    },
    { provide: SIRE_PARSER_PORT, useExisting: SireTxtParserAdapter },
    { provide: SIRE_EXPORTER_PORT, useExisting: SireTxtWriterAdapter },
    {
      /**
       * El almacenamiento del archivo de propuesta se decide en tiempo de
       * arranque: Supabase Storage si hay URL y clave configuradas, con
       * respaldo en disco local si la carga falla.
       */
      provide: SIRE_FILE_STORAGE_PORT,
      useFactory: () => crearSireFileStorage(),
    },
    MockSireSunatGateway,
    {
      provide: SIRE_SUNAT_GATEWAY,
      inject: [MockSireSunatGateway, UnsupportedSireSunatGateway],
      useFactory: (
        mockGateway: MockSireSunatGateway,
        unsupportedGateway: UnsupportedSireSunatGateway,
      ) =>
        selectSireSunatGateway(
          process.env['SUNAT_SIRE_ENV'],
          process.env['NODE_ENV'],
          mockGateway,
          unsupportedGateway,
        ),
    },
  ],
  exports: [SIRE_REPOSITORY_PORT, ReconcileSireUseCase],
})
export class SireModule {}
