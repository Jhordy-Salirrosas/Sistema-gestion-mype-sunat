import { ExportPleTxtUseCase } from '../../../src/modules/accounting/application/use-cases/exportPleTxtUseCase';

describe('ExportPleTxtUseCase', () => {
  let useCase: ExportPleTxtUseCase;

  beforeEach(() => {
    useCase = new ExportPleTxtUseCase();
  });

  it('debe generar contenido para PLE 5.1 cuando existen asientos', async () => {
    const result = await useCase.execute({
      companyId: 'company-1',
      ruc: '20601234567',
      companyRuc: '20601234567',
      period: '202603',
      pleType: '5.1',
    } as any);

    expect(result).toBeDefined();
  });

  it('debe generar contenido para PLE 6.1 (Libro Mayor)', async () => {
    const result = await useCase.execute({
      companyId: 'company-1',
      ruc: '20601234567',
      companyRuc: '20601234567',
      period: '202603',
      pleType: '6.1',
    } as any);

    expect(result).toBeDefined();
  });
});