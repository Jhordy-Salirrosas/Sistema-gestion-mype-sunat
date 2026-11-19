import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';
import { ConciliarPeriodoSireUseCase } from '../../../src/modules/sire/application/use-cases/conciliarPeriodoSireUseCase';
import type { ISireRepositoryPort } from '../../../src/modules/sire/domain/ports/sireRepositoryPort';
import type { RegisterSireAccountingEntryUseCase } from '../../../src/modules/sire/application/use-cases/registerSireAccountingEntryUseCase';

const record = {
  emitterRuc: '20100070970',
  documentType: '01',
  series: 'F001',
  correlative: '00000001',
  taxableBase: 100,
  igvAmount: 18,
  totalAmount: 118,
};

describe('Integración SIRE - contabilidad', () => {
  it('registra el asiento al conciliar registros locales', async () => {
    const repository = {
      ensurePeriodOpen: jest.fn(),
      findProposalsByPeriod: jest.fn().mockResolvedValue([]),
      saveReconciliationResult: jest.fn(),
    } as unknown as ISireRepositoryPort;
    const accounting = { execute: jest.fn().mockResolvedValue(null) };
    const useCase = new ReconcileSireUseCase(
      repository,
      accounting as unknown as RegisterSireAccountingEntryUseCase,
    );

    await useCase.execute(
      {
        period: '202603',
        bookType: 'RVIE_VENTAS',
        localRecords: [record],
      },
      'company-1',
    );

    expect(accounting.execute).toHaveBeenCalledWith(
      'company-1',
      '202603',
      'RVIE_VENTAS',
      [record],
    );
  });

  it('registra el asiento al conciliar el menú con propuestas importadas', async () => {
    const repository = {
      listarImportaciones: jest.fn().mockResolvedValue([]),
      crearConciliacion: jest.fn().mockResolvedValue({
        id: 'conciliacion-1',
        created_at: new Date('2026-03-01T00:00:00.000Z'),
      }),
    };
    const sireRepository = {
      findProposalsByPeriod: jest.fn().mockResolvedValue([
        {
          ...record,
          companyId: 'company-1',
          period: '202603',
          bookType: 'RVIE',
          carSunat: 'CAR-1',
          issueDate: new Date('2026-03-01'),
        },
      ]),
    };
    const accounting = { execute: jest.fn().mockResolvedValue(null) };
    const useCase = new ConciliarPeriodoSireUseCase(
      repository as never,
      sireRepository as unknown as ISireRepositoryPort,
      accounting as unknown as RegisterSireAccountingEntryUseCase,
    );

    await useCase.execute('company-1', '202603', 'RVIE_VENTAS');

    expect(sireRepository.findProposalsByPeriod).toHaveBeenCalledWith(
      'company-1',
      '202603',
      'RVIE',
    );
    expect(accounting.execute).toHaveBeenCalledWith(
      'company-1',
      '202603',
      'RVIE_VENTAS',
      expect.arrayContaining([expect.objectContaining({ totalAmount: 118 })]),
    );
  });

  it('no registra asientos si el periodo no tiene propuestas', async () => {
    const repository = {
      listarImportaciones: jest.fn().mockResolvedValue([]),
      crearConciliacion: jest.fn().mockResolvedValue({
        id: 'conciliacion-1',
        created_at: new Date('2026-03-01T00:00:00.000Z'),
      }),
    };
    const sireRepository = {
      findProposalsByPeriod: jest.fn().mockResolvedValue([]),
    };
    const accounting = { execute: jest.fn() };
    const useCase = new ConciliarPeriodoSireUseCase(
      repository as never,
      sireRepository as unknown as ISireRepositoryPort,
      accounting as unknown as RegisterSireAccountingEntryUseCase,
    );

    await useCase.execute('company-1', '202603', null);

    expect(sireRepository.findProposalsByPeriod).toHaveBeenCalledWith(
      'company-1',
      '202603',
      'RVIE',
    );
    expect(accounting.execute).not.toHaveBeenCalled();
  });
});
