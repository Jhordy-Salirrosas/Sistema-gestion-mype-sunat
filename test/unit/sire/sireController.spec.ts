import { SireController } from '../../../src/modules/sire/infrastructure/controllers/sireController';
import { ReconcileSireUseCase } from '../../../src/modules/sire/application/use-cases/reconcileSireUseCase';
import { validate } from 'class-validator';
import { ReconcilePeriodDto } from '../../../src/modules/sire/application/dto/reconcilePeriodDto';

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
      'company-1',
    );

    expect(result).toBe(mockOutput);
    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ period: '202603' }),
      'company-1',
    );
  });

  it('debería aceptar solo periodos con formato YYYYMM y mes válido', async () => {
    const dto = Object.assign(new ReconcilePeriodDto(), {
      period: '202613',
      bookType: 'RVIE_VENTAS',
      localRecords: [],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('period');
  });
});
