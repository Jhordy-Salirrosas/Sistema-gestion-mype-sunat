import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';
import { ConciliarPeriodoSireUseCase } from '../../../src/modules/sire/application/use-cases/conciliarPeriodoSireUseCase';
import type { ISireRepositoryPort } from '../../../src/modules/sire/domain/ports/sireRepositoryPort';
import type { SireMenuRepository } from '../../../src/modules/sire/infrastructure/persistence/sireMenuRepository';

describe('SIRE - contabilidad solo como datos', () => {
  it('la conciliación local no depende de contabilidad ni genera asientos', async () => {
    const repository = {
      ensurePeriodOpen: jest.fn(),
      findProposalsByPeriod: jest.fn().mockResolvedValue([]),
      saveReconciliationResult: jest.fn(),
    } as unknown as ISireRepositoryPort;

    const useCase = new ReconcileSireUseCase(repository);

    expect(ReconcileSireUseCase.length).toBe(1);
    await useCase.execute(
      {
        period: '202603',
        bookType: 'RVIE_VENTAS',
        localRecords: [],
      },
      'company-1',
    );

    expect(repository.saveReconciliationResult).toHaveBeenCalled();
  });

  it('el GET de conciliación solo lee las importaciones y devuelve los datos', async () => {
    const repository = {
      listarImportaciones: jest.fn().mockResolvedValue([
        {
          id: 'importacion-1',
          periodo: '202603',
          libro: 'RVIE_VENTAS',
          nombre_archivo: 'LE1.txt',
          estado: 'COMPLETED',
          created_at: new Date('2026-03-01T00:00:00.000Z'),
        },
      ]),
    } as unknown as SireMenuRepository;

    const useCase = new ConciliarPeriodoSireUseCase(repository);

    const resultado = await useCase.execute(
      'company-1',
      '202603',
      'RVIE_VENTAS',
    );

    expect(resultado.conciliacionId).toBeNull();
    expect(resultado.periodo).toBe('202603');
    expect(repository.listarImportaciones).toHaveBeenCalledWith(
      'company-1',
      '202603',
      'RVIE_VENTAS',
    );
    expect(
      (repository as unknown as { crearConciliacion?: unknown })
        .crearConciliacion,
    ).toBeUndefined();
  });
});
