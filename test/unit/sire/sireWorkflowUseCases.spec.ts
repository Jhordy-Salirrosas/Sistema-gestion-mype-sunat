import { CloseFiscalPeriodUseCase } from '../../../src/modules/sire/application/use-cases/closeFiscalPeriodUseCase';
import { ExportSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/exportSireProposalUseCase';
import { GetReconciliationHistoryUseCase } from '../../../src/modules/sire/application/use-cases/getReconciliationHistoryUseCase';
import { IngestSireProposalUseCase } from '../../../src/modules/sire/application/use-cases/ingestSireProposalUseCase';
import type { SireProposalEntity } from '../../../src/modules/sire/domain/entities/sireProposalEntity';
import type { ISireExporterPort } from '../../../src/modules/sire/domain/ports/sireExporterPort';
import type { ISireParserPort } from '../../../src/modules/sire/domain/ports/sireParserPort';
import type { ISireRepositoryPort } from '../../../src/modules/sire/domain/ports/sireRepositoryPort';

describe('SIRE workflow use cases', () => {
  const repository: jest.Mocked<ISireRepositoryPort> = {
    saveBatchProposals: jest.fn(),
    ensurePeriodOpen: jest.fn(),
    findProposalsByPeriod: jest.fn(),
    findReconciliationForExport: jest.fn(),
    getClosedReconciliationHistory: jest.fn(),
    closeFiscalPeriod: jest.fn(),
    saveReconciliationResult: jest.fn(),
      hasReportUploadHash: jest.fn(),
      saveReportUpload: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('ingests parsed proposals scoped to the authenticated company', async () => {
    const parsedRecord: Omit<
      SireProposalEntity,
      'companyId' | 'period' | 'bookType'
    > = {
      emitterRuc: '20100070970',
      documentType: '01',
      series: 'F001',
      correlative: '1',
      taxableBase: 100,
      igvAmount: 18,
      totalAmount: 118,
      carSunat: 'CAR-1',
      issueDate: new Date('2026-03-01T00:00:00Z'),
    };
    const parser: jest.Mocked<ISireParserPort> = {
      parse: jest.fn().mockReturnValue({
        records: [parsedRecord],
        rejected: [{ line: 3, reason: 'invalid row' }],
      }),
    };
    const useCase = new IngestSireProposalUseCase(repository, parser);

    const result = await useCase.execute(
      { period: '202603', bookType: 'RVIE_VENTAS' },
      'tenant-1',
      Buffer.from('row'),
    );

    expect(repository.ensurePeriodOpen).toHaveBeenCalledWith(
      'tenant-1',
      '202603',
      'RVIE',
    );
    expect(repository.saveBatchProposals).toHaveBeenCalledWith([
      {
        ...parsedRecord,
        companyId: 'tenant-1',
        period: '202603',
        bookType: 'RVIE',
      },
    ]);
    expect(result).toEqual({
      imported: 1,
      rejected: 1,
      errors: [{ line: 3, reason: 'invalid row' }],
    });
  });

  it('does not parse or save proposals when the period is closed', async () => {
    repository.ensurePeriodOpen.mockRejectedValue(new Error('closed'));
    const parser: jest.Mocked<ISireParserPort> = {
      parse: jest.fn(),
    };
    const useCase = new IngestSireProposalUseCase(repository, parser);

    await expect(
      useCase.execute(
        { period: '202603', bookType: 'RVIE_VENTAS' },
        'tenant-1',
        Buffer.from('row'),
      ),
    ).rejects.toThrow('closed');
    expect(parser.parse).not.toHaveBeenCalled();
    expect(repository.saveBatchProposals).not.toHaveBeenCalled();
  });

  it('exports the requested tenant period using the exporter port', async () => {
    const reconciliation = {
      id: 'rec-1',
      period: '202603',
      bookType: 'RVIE' as const,
      status: 'EN_REVISION' as const,
      totalLocalRecords: 1,
      totalSireRecords: 1,
      exactMatchesCount: 1,
      createdAt: new Date(),
      discrepancies: [],
    };
    repository.findReconciliationForExport.mockResolvedValue(reconciliation);
    const file = { fileName: 'draft.txt', content: Buffer.from('draft') };
    const exporter: jest.Mocked<ISireExporterPort> = {
      export: jest.fn().mockReturnValue(file),
    };
    const useCase = new ExportSireProposalUseCase(repository, exporter);

    await expect(
      useCase.execute(
        { period: '202603', bookType: 'RVIE_VENTAS' },
        'tenant-1',
      ),
    ).resolves.toBe(file);
    expect(repository.findReconciliationForExport).toHaveBeenCalledWith(
      'tenant-1',
      '202603',
      'RVIE',
    );
  });

  it('closes a period only within the authenticated company', async () => {
    const useCase = new CloseFiscalPeriodUseCase(repository);
    await useCase.execute(
      { period: '202603', bookType: 'RCE_COMPRAS' },
      'tenant-2',
    );
    expect(repository.closeFiscalPeriod).toHaveBeenCalledWith(
      'tenant-2',
      '202603',
      'RCE',
    );
  });

  it('returns paginated closed history with per-scenario totals', async () => {
    repository.getClosedReconciliationHistory.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'rec-closed',
          period: '202603',
          bookType: 'RVIE',
          status: 'CERRADO',
          totalLocalRecords: 2,
          totalSireRecords: 2,
          exactMatchesCount: 1,
          createdAt: new Date('2026-04-01T00:00:00Z'),
          discrepancies: [
            {
              discrepancyType: 'COINCIDENCIA_EXACTA',
              emitterRuc: '20100070970',
              documentType: '01',
              series: 'F001',
              correlative: '1',
              amountDifference: 0,
            },
            {
              discrepancyType: 'OMISION_SUNAT',
              emitterRuc: '20100070970',
              documentType: '01',
              series: 'F002',
              correlative: '2',
              amountDifference: 10,
            },
          ],
        },
      ],
    });
    const useCase = new GetReconciliationHistoryUseCase(repository);

    const result = await useCase.execute({ page: 1, limit: 10 }, 'tenant-3');

    expect(repository.getClosedReconciliationHistory).toHaveBeenCalledWith(
      'tenant-3',
      0,
      10,
    );
    expect(result.items[0].totalsByScenario).toEqual({
      COINCIDENCIA_EXACTA: 1,
      DIFERENCIA_MONTOS: 0,
      OMISION_LOCAL: 0,
      OMISION_SUNAT: 1,
      DUPLICADO_LLAVE: 0,
    });
    expect(result.items[0].complianceRate).toBe(50);
  });
});
