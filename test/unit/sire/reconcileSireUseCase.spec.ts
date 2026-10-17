import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';
import type { ISireRepositoryPort } from '../../../src/modules/sire/domain/ports/sireRepositoryPort';

describe('ReconcileSireUseCase', () => {
  let useCase: ReconcileSireUseCase;
  let repository: jest.Mocked<ISireRepositoryPort>;

  beforeEach(() => {
    repository = {
      saveBatchProposals: jest.fn(),
      findProposalsByPeriod: jest.fn().mockResolvedValue([]),
      saveReconciliationResult: jest.fn(),
    };
    useCase = new ReconcileSireUseCase(repository);
  });

  it('debería calcular la tasa de cumplimiento al 100% cuando todos los comprobantes coinciden', async () => {
    const record = {
      emitterRuc: '20100070970',
      documentType: '01',
      series: 'F001',
      correlative: '00000001',
      taxableBase: 100,
      igvAmount: 18,
      totalAmount: 118,
      companyId: 'company-1',
      period: '202603',
      bookType: 'RVIE' as const,
      carSunat: 'CAR-1',
      issueDate: new Date('2026-03-01'),
    };
    repository.findProposalsByPeriod.mockResolvedValue([record]);

    const result = await useCase.execute(
      {
        period: '202603',
        bookType: 'RVIE_VENTAS',
        localRecords: [record],
      },
      'company-1',
    );

    expect(result.totalLocalRecords).toBe(1);
    expect(result.totalSireRecords).toBe(1);
    expect(result.exactMatchesCount).toBe(1);
    expect(result.discrepanciesCount).toBe(0);
    expect(result.complianceRate).toBe(100);
    expect(repository.findProposalsByPeriod).toHaveBeenCalledWith(
      'company-1',
      '202603',
      'RVIE',
    );
    expect(repository.saveReconciliationResult).toHaveBeenCalledTimes(1);
  });

  it('debería calcular tasa de cumplimiento 0% cuando hay omisión', async () => {
    const record = {
      emitterRuc: '20100070970',
      documentType: '01',
      series: 'F001',
      correlative: '00000001',
      taxableBase: 100,
      igvAmount: 18,
      totalAmount: 118,
    };

    const result = await useCase.execute(
      {
        period: '202603',
        bookType: 'RVIE_VENTAS',
        localRecords: [record],
      },
      'company-1',
    );

    expect(result.exactMatchesCount).toBe(0);
    expect(result.discrepanciesCount).toBe(1);
    expect(result.complianceRate).toBe(0);
  });
});
