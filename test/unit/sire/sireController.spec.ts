import { SireController } from '../../../src/modules/sire/infrastructure/controllers/sireController';
import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';
import { IngestSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/ingestSireProposalUseCase';
import { ExportSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/exportSireProposalUseCase';
import { GetReconciliationHistoryUseCase } from '../../../src/modules/sire/application/use-cases/getReconciliationHistoryUseCase';
import { CloseFiscalPeriodUseCase } from '../../../src/modules/sire/application/use-cases/closeFiscalPeriodUseCase';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReconcilePeriodDto } from '../../../src/modules/sire/application/dto/reconcilePeriodDto';
import { UploadSireReportUseCase } from '../../../src/modules/sire/application/use-cases/uploadSireReportUseCase';
import { GetSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/getSireProposalUseCase';
import { ExcludeSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/excludeSireRecordUseCase';
import { ReplaceSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/replaceSireProposalUseCase';
import { RegisterSirePreliminaryUseCase } from '../../../src/modules/sire/application/use-cases/registerSirePreliminaryUseCase';
import { DeleteSirePreliminaryUseCase } from '../../../src/modules/sire/application/use-cases/deleteSirePreliminaryUseCase';
import { GenerateSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/generateSireRecordUseCase';
import { SireTicketManagerService } from '../../../src/modules/sire/application/sireTicketManagerService';
import { AcceptSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/acceptSireProposalUseCase';
import { RestoreSireRecordUseCase } from '../../../src/modules/sire/application/use-cases/restoreSireRecordUseCase';

describe('SireController', () => {
  let controller: SireController;
  let useCase: jest.Mocked<ReconcileSireUseCase>;
  const ingestUseCase = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<IngestSireProposalUseCase>;
  const exportUseCase = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<ExportSireProposalUseCase>;
  const historyUseCase = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<GetReconciliationHistoryUseCase>;
  const closeUseCase = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<CloseFiscalPeriodUseCase>;
  const uploadReportUseCase = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<UploadSireReportUseCase>;
  const lifecycle = {
    getProposal: { execute: jest.fn() } as unknown as jest.Mocked<GetSireProposalUseCase>,
    exclude: { execute: jest.fn() } as unknown as jest.Mocked<ExcludeSireRecordUseCase>,
    replace: { execute: jest.fn() } as unknown as jest.Mocked<ReplaceSireProposalUseCase>,
    register: { execute: jest.fn() } as unknown as jest.Mocked<RegisterSirePreliminaryUseCase>,
    remove: { execute: jest.fn() } as unknown as jest.Mocked<DeleteSirePreliminaryUseCase>,
    generate: { execute: jest.fn() } as unknown as jest.Mocked<GenerateSireRecordUseCase>,
    tickets: { getPeriod: jest.fn(), getRecords: jest.fn(), poll: jest.fn() } as unknown as jest.Mocked<SireTicketManagerService>,
    accept: { execute: jest.fn() } as unknown as jest.Mocked<AcceptSireProposalUseCase>,
    restore: { execute: jest.fn() } as unknown as jest.Mocked<RestoreSireRecordUseCase>,
  };

  beforeEach(() => {
    useCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ReconcileSireUseCase>;

    controller = new SireController(
      useCase,
      ingestUseCase,
      exportUseCase,
      historyUseCase,
      closeUseCase,
      uploadReportUseCase,
      lifecycle.getProposal,
      lifecycle.exclude,
      lifecycle.replace,
      lifecycle.register,
      lifecycle.remove,
      lifecycle.generate,
      lifecycle.tickets,
      lifecycle.accept,
      lifecycle.restore,
    );
  });

  it('debería delegar la petición de conciliación al caso de uso', async () => {
    const mockOutput = {
      period: '202603',
      bookType: 'RVIE_VENTAS' as const,
      totalLocalRecords: 1,
      totalSireRecords: 1,
      exactMatchesCount: 1,
      discrepanciesCount: 0,
      complianceRate: 100,
      discrepancies: [],
    };

    useCase.execute.mockResolvedValue(mockOutput);

    const result = await controller.reconcile(
      {
        period: '202603',
        bookType: 'RVIE_VENTAS',
        localRecords: [],
      },
      {
        sub: 'user-1',
        email: 'user@example.test',
        companyId: 'company-1',
        role: 'ACCOUNTANT',
      },
    );

    expect(result).toBe(mockOutput);
    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ period: '202603' }),
      'company-1',
    );
  });

  it('debería aceptar solo periodos con formato YYYYMM y mes válido', async () => {
    const dto = plainToInstance(ReconcilePeriodDto, {
      period: '202613',
      bookType: 'RVIE_VENTAS',
      localRecords: [],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('period');
  });

  it('debería rechazar tipos de comprobante fuera del catálogo soportado', async () => {
    const dto = plainToInstance(ReconcilePeriodDto, {
      period: '202603',
      bookType: 'RVIE_VENTAS',
      localRecords: [
        {
          emitterRuc: '20100070970',
          documentType: '99',
          series: 'F001',
          correlative: '1',
          taxableBase: 100,
          igvAmount: 18,
          totalAmount: 118,
        },
      ],
    });

    const errors = await validate(dto, { whitelist: true });
    const recordErrors = errors[0].children?.[0].children ?? [];

    expect(recordErrors.map((error) => error.property)).toContain(
      'documentType',
    );
  });

  it('debería rechazar un usuario sin empresa autenticada', async () => {
    await expect(
      controller.reconcile(
        {
          period: '202603',
          bookType: 'RVIE_VENTAS',
          localRecords: [],
        },
        {
          sub: 'user-1',
          email: 'user@example.test',
          companyId: '',
          role: 'ACCOUNTANT',
        },
      ),
    ).rejects.toThrow('La empresa del usuario no está definida.');
  });

  it('debería delegar la carga CSV/XLSX con la empresa autenticada', async () => {
    const file = {
      originalname: 'rce.csv',
      mimetype: 'text/csv',
      buffer: Buffer.from('content'),
    };
    const output = {
      imported: 1,
      rejected: 0,
      errors: [],
      fileHash: 'hash-de-prueba',
      fileName: 'rce.csv',
      reportType: 'RCE' as const,
    };
    uploadReportUseCase.execute.mockResolvedValue(output);

    await expect(
      controller.uploadReport(
        { period: '202610', bookType: 'RCE_COMPRAS' },
        file,
        {
          sub: 'user-1',
          email: 'user@example.test',
          companyId: 'company-1',
          role: 'ACCOUNTANT',
        },
      ),
    ).resolves.toBe(output);
    expect(uploadReportUseCase.execute).toHaveBeenCalledWith(
      { period: '202610', bookType: 'RCE_COMPRAS' },
      'company-1',
      file,
    );
  });

  it('debería rechazar la carga cuando falta el archivo', async () => {
    await expect(
      controller.uploadReport(
        { period: '202610', bookType: 'RVIE_VENTAS' },
        undefined,
        {
          sub: 'user-1',
          email: 'user@example.test',
          companyId: 'company-1',
          role: 'ACCOUNTANT',
        },
      ),
    ).rejects.toThrow('Falta el archivo CSV/XLSX.');
  });

  it('debería delegar las operaciones del contrato provisional', async () => {
    const user = { sub: 'user-1', companyId: 'company-1' } as never;
    const dto = { period: '202610', bookType: 'RCE_COMPRAS' as const };
    lifecycle.getProposal.execute.mockResolvedValue({ state: 'PROPUESTA' } as never);
    lifecycle.exclude.execute.mockResolvedValue({ excluded: true } as never);
    lifecycle.restore.execute.mockResolvedValue({ restored: true } as never);
    lifecycle.accept.execute.mockResolvedValue({ state: 'PROCESANDO_PRELIMINAR' } as never);
    lifecycle.register.execute.mockResolvedValue({ state: 'PROCESANDO_PRELIMINAR' } as never);
    lifecycle.remove.execute.mockResolvedValue({ state: 'PROCESANDO_ELIMINACION' } as never);
    lifecycle.replace.execute.mockResolvedValue({ state: 'PROCESANDO_REEMPLAZO' } as never);
    lifecycle.generate.execute.mockResolvedValue({ state: 'PROCESANDO_GENERACION' } as never);
    lifecycle.tickets.getPeriod.mockResolvedValue({ state: 'CON_PRELIMINAR' } as never);
    lifecycle.tickets.getRecords.mockResolvedValue([] as never);
    lifecycle.tickets.poll.mockResolvedValue({ status: 'PENDIENTE' } as never);

    await controller.getPropuesta({ ruc: '20123456789', periodo: '202610', libro: 'RCE' }, user);
    await controller.exclude({ proposalId: 'p-1' }, user);
    await controller.restore({ proposalId: 'p-1' }, user);
    await controller.accept({ ...dto, confirmed: true }, user);
    await controller.getPreliminar({ periodo: '202610', libro: 'RCE' }, user);
    await controller.registerPreliminar(dto, user);
    await controller.deletePreliminary(dto, user);
    await controller.reemplazo(dto, { buffer: Buffer.from('txt') } as never, user);
    await controller.getGenerado({ periodo: '202610', libro: 'RCE' }, user);
    await controller.status({ periodo: '202610', libro: 'RCE' }, user);

    expect(lifecycle.getProposal.execute).toHaveBeenCalled();
    expect(lifecycle.accept.execute).toHaveBeenCalledWith(
      { ...dto, confirmed: true },
      'company-1',
      true,
    );
    expect(lifecycle.tickets.poll).toHaveBeenCalledWith('company-1', '202610', 'RCE_COMPRAS');
  });
});
