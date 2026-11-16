import {
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ReconcilePeriodDto } from '../../../src/modules/sire/application/dto/reconcilePeriodDto';
import type { SireDashboardGranularity } from '../../../src/modules/sire/application/dto/sireDashboardHistoryQueryDto';
import { SireDashboardMetricsService } from '../../../src/modules/sire/application/sireDashboardMetricsService';
import { SireTicketManagerService } from '../../../src/modules/sire/application/sireTicketManagerService';
import { ExportSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/exportSireProposalUseCase';
import { GetReconciliationHistoryUseCase } from '../../../src/modules/sire/application/use-cases/getReconciliationHistoryUseCase';
import { ImportarPropuestaSireUseCase } from '../../../src/modules/sire/application/use-cases/importarPropuestaSireUseCase';
import { IngestSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/ingestSireProposalUseCase';
import { ObtenerResumenSireUseCase } from '../../../src/modules/sire/application/use-cases/obtenerResumenSireUseCase';
import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';
import {
  ConsultarReporteSireUseCase,
  ReportarSireUseCase,
} from '../../../src/modules/sire/application/use-cases/reportarSireUseCase';
import { RestoreSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/restoreSireRecordUseCase';
import type { ISireExporterPort } from '../../../src/modules/sire/domain/ports/sireExporterPort';
import type { ISireParserPort } from '../../../src/modules/sire/domain/ports/sireParserPort';
import type { ISireRepositoryPort } from '../../../src/modules/sire/domain/ports/sireRepositoryPort';
import type { SireFileStoragePort } from '../../../src/modules/sire/domain/ports/sireFileStoragePort';
import type { SireSunatGatewayPort } from '../../../src/modules/sire/domain/ports/sireSunatGatewayPort';
import { validarNombreArchivoSire } from '../../../src/modules/sire/domain/rules/sireFileNameRule';
import type { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';
import { ResilienceStateService } from '../../../src/modules/resilience/application/resilienceStateService';
import type { QueueService } from '../../../src/modules/resilience/infrastructure/queue/queue.service';

jest.mock('../../../src/modules/sire/domain/rules/sireFileNameRule', () => {
  const actual = jest.requireActual<
    typeof import('../../../src/modules/sire/domain/rules/sireFileNameRule')
  >('../../../src/modules/sire/domain/rules/sireFileNameRule');

  return {
    __esModule: true,
    ...actual,
    validarNombreArchivoSire: jest.fn(actual.validarNombreArchivoSire),
  };
});

const reglaArchivoSire = jest.requireActual<
  typeof import('../../../src/modules/sire/domain/rules/sireFileNameRule')
>('../../../src/modules/sire/domain/rules/sireFileNameRule');

const validarNombreArchivoSireMock =
  validarNombreArchivoSire as unknown as jest.Mock;

const COMPANY_ID = 'company-id';
const RUC = '20601030013';

function crearRepositoryMenu() {
  return {
    crearImportacion: jest.fn().mockResolvedValue({
      id: 'importacion-id',
      created_at: new Date('2026-01-05T10:00:00.000Z'),
    }),
    fallarImportacion: jest.fn().mockResolvedValue(undefined),
    crearReporte: jest.fn().mockResolvedValue({
      id: 'reporte-id',
      created_at: new Date('2026-01-07T10:00:00.000Z'),
    }),
    fallarReporte: jest.fn().mockResolvedValue(undefined),
    buscarReportePorMessageId: jest.fn(),
    contarImportaciones: jest.fn().mockResolvedValue(0),
    contarConciliaciones: jest.fn().mockResolvedValue(0),
    contarReportes: jest.fn().mockResolvedValue(0),
  };
}

function crearQueue() {
  return {
    enqueueSireImport: jest.fn().mockResolvedValue('job-id'),
  };
}

function crearStorage() {
  return {
    guardar: jest.fn().mockResolvedValue({
      ruta: 'sire/company-id/202401/archivo.zip',
      hash: 'hash-del-archivo',
      backend: 'SUPABASE',
      bytes: 128,
    }),
  };
}

function crearArchivo(nombre: string) {
  return {
    originalname: nombre,
    mimetype: 'application/octet-stream',
    buffer: Buffer.from('contenido'),
  };
}

describe('SIRE use case branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    validarNombreArchivoSireMock.mockReset();
    validarNombreArchivoSireMock.mockImplementation(
      reglaArchivoSire.validarNombreArchivoSire,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ExportSireProposalUseCase', () => {
    it('rejects the export when the period has no reconciliation to export', async () => {
      const repository = {
        findReconciliationForExport: jest.fn().mockResolvedValue(null),
      } as unknown as ISireRepositoryPort;
      const exporter = {
        export: jest.fn(),
      } as unknown as ISireExporterPort;
      const useCase = new ExportSireProposalUseCase(repository, exporter);

      await expect(
        useCase.execute(
          { period: '202603', bookType: 'RVIE_VENTAS' },
          COMPANY_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(exporter.export).not.toHaveBeenCalled();
    });
  });

  describe('GetReconciliationHistoryUseCase', () => {
    it('ignores discrepancies whose scenario is not part of the known totals', async () => {
      const repository = {
        getClosedReconciliationHistory: jest.fn().mockResolvedValue({
          total: 1,
          items: [
            {
              id: 'rec-1',
              period: '202603',
              bookType: 'RCE',
              status: 'CERRADO',
              totalLocalRecords: 2,
              totalSireRecords: 2,
              exactMatchesCount: 2,
              createdAt: new Date('2026-04-01T00:00:00.000Z'),
              discrepancies: [
                {
                  discrepancyType: 'ESCENARIO_DESCONOCIDO',
                  emitterRuc: '20100070970',
                  documentType: '01',
                  series: 'F001',
                  correlative: '1',
                  amountDifference: 0,
                },
              ],
            },
          ],
        }),
      } as unknown as ISireRepositoryPort;
      const useCase = new GetReconciliationHistoryUseCase(repository);

      const result = await useCase.execute({ page: 1, limit: 10 }, COMPANY_ID);

      expect(result.items[0].totalsByScenario).toEqual({
        COINCIDENCIA_EXACTA: 0,
        DIFERENCIA_MONTOS: 0,
        OMISION_LOCAL: 0,
        OMISION_SUNAT: 0,
        DUPLICADO_LLAVE: 0,
      });
    });
  });

  describe('ImportarPropuestaSireUseCase', () => {
    it('uses the generic message when the file name validation has no detail', async () => {
      validarNombreArchivoSireMock.mockImplementationOnce(() => ({
        valido: false,
      }));
      const repository = crearRepositoryMenu() as unknown as SireMenuRepository;
      const queue = crearQueue() as unknown as QueueService;
      const storage = crearStorage() as unknown as SireFileStoragePort;
      const useCase = new ImportarPropuestaSireUseCase(
        repository,
        queue,
        storage,
      );

      await expect(
        useCase.execute(
          COMPANY_ID,
          RUC,
          {},
          crearArchivo(`LE${RUC}-RCE-202401.zip`),
        ),
      ).rejects.toThrow(
        'El nombre del archivo no cumple el formato de una propuesta SIRE.',
      );
      expect(queue.enqueueSireImport).not.toHaveBeenCalled();
    });

    it('rejects files whose period and book cannot be resolved', async () => {
      const repository = crearRepositoryMenu() as unknown as SireMenuRepository;
      const queue = crearQueue() as unknown as QueueService;
      const storage = crearStorage() as unknown as SireFileStoragePort;
      const useCase = new ImportarPropuestaSireUseCase(
        repository,
        queue,
        storage,
      );

      await expect(
        useCase.execute(COMPANY_ID, RUC, {}, crearArchivo(`LE${RUC}.zip`)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.guardar).not.toHaveBeenCalled();
      expect(repository.crearImportacion).not.toHaveBeenCalled();
    });

    it('still reports the queue failure when the import cannot be marked as failed', async () => {
      const repository = crearRepositoryMenu() as unknown as SireMenuRepository;
      const queue = crearQueue() as unknown as QueueService;
      (queue.enqueueSireImport as jest.Mock).mockRejectedValue(
        new Error('PgBoss está en modo bypass.'),
      );
      (repository.fallarImportacion as jest.Mock).mockRejectedValue(
        new Error('la base de datos no responde'),
      );
      const useCase = new ImportarPropuestaSireUseCase(
        repository,
        queue,
        crearStorage() as unknown as SireFileStoragePort,
      );

      await expect(
        useCase.execute(
          COMPANY_ID,
          RUC,
          {},
          crearArchivo(`LE${RUC}-RCE-202401.zip`),
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.fallarImportacion).toHaveBeenCalledWith(
        'importacion-id',
        'QUEUE_ENQUEUE_FAILED',
      );
    });
  });

  describe('IngestSireProposalUseCase', () => {
    it('rejects an empty file before touching the period', async () => {
      const repository = {
        ensurePeriodOpen: jest.fn(),
        saveBatchProposals: jest.fn(),
      } as unknown as ISireRepositoryPort;
      const parser = {
        parse: jest.fn().mockReturnValue({ records: [], rejected: [] }),
      } as unknown as ISireParserPort;
      const useCase = new IngestSireProposalUseCase(repository, parser);

      await expect(
        useCase.execute(
          { period: '202603', bookType: 'RVIE_VENTAS' },
          COMPANY_ID,
          Buffer.alloc(0),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.ensurePeriodOpen).not.toHaveBeenCalled();
      expect(parser.parse).not.toHaveBeenCalled();
    });

    it('rejects a parsed file without importable rows', async () => {
      const repository = {
        ensurePeriodOpen: jest.fn().mockResolvedValue(undefined),
        saveBatchProposals: jest.fn(),
      } as unknown as ISireRepositoryPort;
      const parser = {
        parse: jest.fn().mockReturnValue({ records: [], rejected: [] }),
      } as unknown as ISireParserPort;
      const useCase = new IngestSireProposalUseCase(repository, parser);

      await expect(
        useCase.execute(
          { period: '202603', bookType: 'RVIE_VENTAS' },
          COMPANY_ID,
          Buffer.from('sin filas'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.saveBatchProposals).not.toHaveBeenCalled();
    });
  });

  describe('ObtenerResumenSireUseCase', () => {
    it('defaults the book to RVIE_VENTAS when the request does not send one', async () => {
      const repository = crearRepositoryMenu() as unknown as SireMenuRepository;
      const useCase = new ObtenerResumenSireUseCase(repository);

      const result = await useCase.execute(COMPANY_ID, '202401', null);

      expect(result.libro).toBeNull();
      expect(result.resumen.libro).toBe('RVIE');
      expect(result.resumen.totalComprobantes).toBe(5);
    });
  });

  describe('ReconcileSireUseCase', () => {
    it('reconciles the purchase book against the RCE records of the repository', async () => {
      const repository = {
        ensurePeriodOpen: jest.fn().mockResolvedValue(undefined),
        findProposalsByPeriod: jest.fn().mockResolvedValue([]),
        saveReconciliationResult: jest.fn().mockResolvedValue(undefined),
      } as unknown as ISireRepositoryPort;
      const useCase = new ReconcileSireUseCase(repository);
      const dto: ReconcilePeriodDto = {
        period: '202603',
        bookType: 'RCE_COMPRAS',
        localRecords: [
          {
            emitterRuc: '20100070970',
            documentType: '01',
            series: 'F001',
            correlative: '00000001',
            taxableBase: 100,
            igvAmount: 18,
            totalAmount: 118,
          },
        ],
      };

      const result = await useCase.execute(dto, COMPANY_ID);

      expect(repository.ensurePeriodOpen).toHaveBeenCalledWith(
        COMPANY_ID,
        '202603',
        'RCE',
      );
      expect(repository.findProposalsByPeriod).toHaveBeenCalledWith(
        COMPANY_ID,
        '202603',
        'RCE',
      );
      expect(repository.saveReconciliationResult).toHaveBeenCalledWith(
        expect.objectContaining({ bookType: 'RCE' }),
      );
      expect(result.bookType).toBe('RCE_COMPRAS');
    });
  });

  describe('ConsultarReporteSireUseCase', () => {
    it('rejects the polling when the report does not exist', async () => {
      const repository = crearRepositoryMenu() as unknown as SireMenuRepository;
      (repository.buscarReportePorMessageId as jest.Mock).mockResolvedValue(
        null,
      );
      const useCase = new ConsultarReporteSireUseCase(repository);

      await expect(
        useCase.execute(COMPANY_ID, 'message-inexistente'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('falls back to the requested message id when the report has none stored', async () => {
      const repository = crearRepositoryMenu() as unknown as SireMenuRepository;
      (repository.buscarReportePorMessageId as jest.Mock).mockResolvedValue({
        id: 'reporte-id',
        periodo: '202401',
        libro: 'RCE_COMPRAS',
        estado: 'PENDING',
        message_id: null,
        ticket: null,
        error_code: null,
        created_at: new Date('2026-01-07T10:00:00.000Z'),
        completed_at: null,
      });
      const useCase = new ConsultarReporteSireUseCase(repository);

      const result = await useCase.execute(COMPANY_ID, 'message-id');

      expect(result.messageId).toBe('message-id');
      expect(result.completedAt).toBeNull();
    });
  });

  describe('ReportarSireUseCase', () => {
    it('still reports the queue failure when the report cannot be marked as failed', async () => {
      const repository = crearRepositoryMenu() as unknown as SireMenuRepository;
      const queue = crearQueue() as unknown as QueueService;
      (queue.enqueueSireImport as jest.Mock).mockRejectedValue(
        new Error('sin cola'),
      );
      (repository.fallarReporte as jest.Mock).mockRejectedValue(
        new Error('la base de datos no responde'),
      );
      const useCase = new ReportarSireUseCase(repository, queue);

      await expect(
        useCase.execute(COMPANY_ID, {
          periodo: '202401',
          libro: 'RCE_COMPRAS',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.fallarReporte).toHaveBeenCalledWith(
        'reporte-id',
        'QUEUE_ENQUEUE_FAILED',
      );
    });
  });

  describe('RestoreSireRecordUseCase', () => {
    it('rejects the restore when the proposal does not exist', async () => {
      const repository = {
        getProposal: jest.fn().mockResolvedValue(null),
        restoreProposal: jest.fn(),
      } as unknown as ISireRepositoryPort;
      const sunat = {
        restoreRecord: jest.fn(),
      } as unknown as SireSunatGatewayPort;
      const useCase = new RestoreSireRecordUseCase(repository, sunat);

      await expect(
        useCase.execute(COMPANY_ID, 'proposal-inexistente'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(sunat.restoreRecord).not.toHaveBeenCalled();
    });
  });

  describe('SireDashboardMetricsService', () => {
    function crearServicio() {
      const history = {
        getMetricsSummary: jest.fn().mockResolvedValue({
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalRetries: 0,
          slowCalls: 0,
          bufferedInvoicesCount: 0,
          recentFailedCalls: 0,
        }),
        getHistory: jest.fn().mockResolvedValue([]),
      };
      const service = new SireDashboardMetricsService(
        new ResilienceStateService(),
        history as never,
      );
      return { service, history };
    }

    it('reports zero rates when the window had no calls at all', async () => {
      const { service } = crearServicio();

      const metrics = await service.getMetrics(COMPANY_ID);

      expect(metrics.totalCalls).toBe(0);
      expect(metrics.failureRate).toBe(0);
      expect(metrics.slowCallRate).toBe(0);
    });

    it('rejects a granularity that is not supported', async () => {
      const { service, history } = crearServicio();

      await expect(
        service.getHistory(COMPANY_ID, {
          start: '2026-10-29T11:00:00.000Z',
          end: '2026-10-29T12:00:00.000Z',
          granularity: 'semana' as unknown as SireDashboardGranularity,
          limit: 100,
          offset: 0,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(history.getHistory).not.toHaveBeenCalled();
    });
  });

  describe('SireTicketManagerService', () => {
    function crearDependencias() {
      const repository = {
        getPeriod: jest.fn(),
        getPeriodProposals: jest.fn().mockResolvedValue([]),
        setPeriodState: jest.fn().mockResolvedValue(undefined),
      };
      const sunat = {
        getTicketStatus: jest
          .fn()
          .mockResolvedValue({ ticket: 'T-1', status: 'TERMINADO' }),
      };
      return { repository, sunat };
    }

    it('returns the proposals of the period for the requested book', async () => {
      const { repository, sunat } = crearDependencias();
      const manager = new SireTicketManagerService(
        repository as never,
        sunat as never,
      );

      await manager.getRecords(COMPANY_ID, '202611', 'RCE_COMPRAS');

      expect(repository.getPeriodProposals).toHaveBeenCalledWith(
        COMPANY_ID,
        '202611',
        'RCE',
      );
    });

    it('keeps the proposal state when the ticket is neither a generation nor a preliminary registration', async () => {
      const { repository, sunat } = crearDependencias();
      repository.getPeriod.mockResolvedValue({
        id: 'p',
        state: 'PROCESANDO',
        ticket: 'T-1',
        ticketOperation: 'PROPUESTA',
      });
      const manager = new SireTicketManagerService(
        repository as never,
        sunat as never,
      );

      const result = await manager.poll(COMPANY_ID, '202611', 'RCE_COMPRAS');

      expect(result).toMatchObject({ status: 'TERMINADO', state: 'PROPUESTA' });
      expect(repository.setPeriodState).toHaveBeenCalledWith(
        COMPANY_ID,
        '202611',
        'RCE',
        'PROPUESTA',
      );
    });
  });
});
