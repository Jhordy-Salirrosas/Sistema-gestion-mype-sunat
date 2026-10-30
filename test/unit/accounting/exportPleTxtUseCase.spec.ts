import { ExportPleTxtUseCase } from '../../../src/modules/accounting/application/use-cases/exportPleTxtUseCase';

describe('ExportPleTxtUseCase', () => {
  let useCase: ExportPleTxtUseCase;

  const mockEntries: any[] = [
    {
      id: 'entry-1',
      entryNumber: '001-202603-001', // Caso 1: CUO formateado
      glosa: 'Venta de mercadería',
      lines: [
        { lineOrder: 1, accountCode: '1212', debitAmount: 118, creditAmount: 0 },
        { lineOrder: 2, accountCode: '40111', debitAmount: 0, creditAmount: 18 },
        { lineOrder: 3, accountCode: '7011', debitAmount: 0, creditAmount: 100 },
      ],
    },
    {
      id: 'entry-2',
      entryNumber: 2, // Caso 2: CUO numérico sin formatear
      glosa: 'Asiento sin formatear',
      lines: [
        { line_order: 1, account_code: '101', debit_amount: 50, credit_amount: 0 },
        { line_order: 2, account_code: '701', debit_amount: 0, credit_amount: 50 },
      ],
    },
  ];

  beforeEach(() => {
    useCase = new ExportPleTxtUseCase();
  });

  it('debe generar el archivo PLE TXT con datos cuando se envían asientos contables', async () => {
    const dto = {
      companyRuc: '20601234567',
      year: 2026,
      month: 3,
      bookCode: '050100',
    };

    const result = await useCase.execute(dto as any, mockEntries);

    expect(result).toBeDefined();
    expect(result.recordsCount).toBe(5); // 3 líneas de entry-1 + 2 líneas de entry-2
    expect(result.totalDebit).toBe(168);
    expect(result.totalCredit).toBe(168);
    expect(result.content).toContain('1212|118.00|0.00|Venta de mercadería|1|');
    expect(typeof result.fileName).toBe('string');
  });

  it('debe generar la estructura vacía cuando el arreglo de asientos es vacío', async () => {
    const dto = {
      companyRuc: '20601234567',
      year: 2026,
      month: 3,
      bookCode: '050100',
    };

    const result = await useCase.execute(dto as any, []);

    expect(result).toBeDefined();
    expect(result.recordsCount).toBe(0);
    expect(result.totalDebit).toBe(0);
    expect(result.totalCredit).toBe(0);
    expect(result.content).toBe('');
  });
});