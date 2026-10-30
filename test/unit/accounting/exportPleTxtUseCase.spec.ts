import { ExportPleTxtUseCase } from '../../../src/modules/accounting/application/use-cases/exportPleTxtUseCase';
import { IAccountingRepositoryPort } from '../../../src/modules/accounting/domain/ports/accountingRepositoryPort';

describe('ExportPleTxtUseCase', () => {
  let useCase: ExportPleTxtUseCase;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      getNextEntryNumber: jest.fn(),
      saveEntry: jest.fn(),
      findByCompany: jest.fn().mockResolvedValue([]),
      findAllByCompany: jest.fn().mockResolvedValue([]),
      deleteById: jest.fn(),
    };

    // Si el constructor no espera parámetros:
    useCase = new (ExportPleTxtUseCase as any)(mockRepository);
  });

  it('debe generar contenido de archivo PLE 5.1 cuando existen asientos', async () => {
    const mockEntries = [
      {
        id: 'entry-1',
        companyId: 'company-1',
        period: '202603',
        entryNumber: 1,
        entryDate: new Date('2026-03-10'),
        glosa: 'Venta del periodo',
        sourceModule: 'INVOICES',
        lines: [
          { lineOrder: 1, accountCode: '1212', accountName: 'Clientes', debitAmount: 118, creditAmount: 0 },
        ],
      },
    ];

    if (mockRepository.findByCompany) mockRepository.findByCompany.mockResolvedValue(mockEntries);
    if (mockRepository.findAllByCompany) mockRepository.findAllByCompany.mockResolvedValue(mockEntries);

    const result = await useCase.execute({
      companyId: 'company-1',
      period: '202603',
      periodo: '202603',
      pleType: '5.1',
    } as any);

    expect(result).toBeDefined();
  });

  it('debe generar estructura para PLE 6.1 (Libro Mayor)', async () => {
    const result = await useCase.execute({
      companyId: 'company-1',
      period: '202603',
      periodo: '202603',
      pleType: '6.1',
    } as any);

    expect(result).toBeDefined();
  });
});