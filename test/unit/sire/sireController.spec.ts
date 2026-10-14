import { SireController } from '../../../src/modules/sire/infrastructure/controllers/sireController';
import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';

describe('SireController', () => {
  let controller: SireController;
  let useCase: jest.Mocked<ReconcileSireUseCase>;

  beforeEach(() => {
    useCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ReconcileSireUseCase>;

    controller = new SireController(useCase);
  });

  it('debería delegar la petición de conciliación al caso de uso', async () => {
    const mockOutput = {
      period: '2026-03',
      bookType: 'RVIE_VENTAS',
      totalLocalRecords: 1,
      totalSireRecords: 1,
      exactMatchesCount: 1,
      discrepanciesCount: 0,
      complianceRate: 100,
      discrepancies: [],
    };

    useCase.execute.mockResolvedValue(mockOutput);

    const result = await controller.reconcile({
      period: '2026-03',
      bookType: 'RVIE_VENTAS',
      localRecords: [],
      sireRecords: [],
    });

    expect(result).toBe(mockOutput);
    expect(useCase.execute).toHaveBeenCalled();
  });
});
