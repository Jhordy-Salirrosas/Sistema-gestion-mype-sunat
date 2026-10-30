import { ExportPleTxtUseCase } from '../../../src/modules/accounting/application/use-cases/exportPleTxtUseCase';

describe('ExportPleTxtUseCase', () => {
  let useCase: ExportPleTxtUseCase;
  let mockRepository: any;

  const mockEntries = [
    {
      id: 'entry-1',
      companyId: 'company-1',
      period: '202603',
      entryNumber: 1,
      entryDate: new Date('2026-03-10'),
      glosa: 'Venta de mercadería',
      sourceModule: 'INVOICES',
      lines: [
        { lineOrder: 1, accountCode: '1212', accountName: 'Facturas por cobrar', debitAmount: 118, creditAmount: 0 },
        { lineOrder: 2, accountCode: '40111', accountName: 'IGV', debitAmount: 0, creditAmount: 18 },
        { lineOrder: 3, accountCode: '7011', accountName: 'Ventas', debitAmount: 0, creditAmount: 100 },
      ],
    },
  ];

  beforeEach(() => {
    mockRepository = {
      getNextEntryNumber: jest.fn(),
      saveEntry: jest.fn(),
      findByCompany: jest.fn().mockResolvedValue(mockEntries),
      findAllByCompany: jest.fn().mockResolvedValue(mockEntries),
      deleteById: jest.fn(),
    };

    useCase = new (ExportPleTxtUseCase as any)(mockRepository);
  });

  it('debe generar contenido de archivo PLE 5.1 cuando existen asientos', async () => {
    const result = await useCase.execute({
      companyId: 'company-1',
      ruc: '20601234567',
      companyRuc: '20601234567',
      period: '202603',
      pleType: '5.1',
    } as any);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('debe generar estructura para PLE 6.1 (Libro Mayor) cuando existen asientos', async () => {
    const result = await useCase.execute({
      companyId: 'company-1',
      ruc: '20601234567',
      companyRuc: '20601234567',
      period: '202603',
      pleType: '6.1',
    } as any);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('debe manejar el caso cuando no existen asientos contables', async () => {
    mockRepository.findByCompany.mockResolvedValue([]);
    mockRepository.findAllByCompany.mockResolvedValue([]);

    const result = await useCase.execute({
      companyId: 'company-1',
      ruc: '20601234567',
      companyRuc: '20601234567',
      period: '202603',
      pleType: '5.1',
    } as any);

    expect(result).toBeDefined();
  });
});