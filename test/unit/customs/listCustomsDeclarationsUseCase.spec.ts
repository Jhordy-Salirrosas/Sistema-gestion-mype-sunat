import { ListCustomsDeclarationsUseCase } from '../../../src/modules/customs/application/use-cases/listCustomsDeclarationsUseCase';
import type { ICustomsRepositoryPort, CustomsDeclarationSummary } from '../../../src/modules/customs/domain/ports/customsRepositoryPort';

describe('ListCustomsDeclarationsUseCase', () => {
  let useCase: ListCustomsDeclarationsUseCase;
  let mockCustomsRepo: jest.Mocked<ICustomsRepositoryPort>;

  beforeEach(() => {
    mockCustomsRepo = {
      saveDeclarationWithItemsAndKardex: jest.fn(),
      findDeclarationById: jest.fn(),
      findDeclarationsByCompany: jest.fn(),
      findKardexMovementsByCompany: jest.fn(),
      findLatestKardexMovementByItem: jest.fn(),
      registerKardexMovements: jest.fn(),
    };

    useCase = new ListCustomsDeclarationsUseCase(mockCustomsRepo);
  });

  it('debe delegar la búsqueda de declaraciones por empresa al repositorio aduanero', async () => {
    const mockDeclarations: CustomsDeclarationSummary[] = [
      {
        id: 'decl-1',
        duaNumber: '118-2026-10-001234',
        customsAgencyCode: '118',
        numerationDate: new Date('2026-03-10'),
        cifValueUsd: 10000,
        cifValuePen: 38500,
        totalCustomsTaxesPen: 1540,
        status: 'REGISTRADO',
        itemsCount: 2,
        createdAt: new Date('2026-03-10'),
      },
    ];

    mockCustomsRepo.findDeclarationsByCompany.mockResolvedValue(mockDeclarations);

    const result = await useCase.execute('comp-1');

    expect(result).toEqual(mockDeclarations);
    expect(mockCustomsRepo.findDeclarationsByCompany).toHaveBeenCalledWith('comp-1');
  });
});
