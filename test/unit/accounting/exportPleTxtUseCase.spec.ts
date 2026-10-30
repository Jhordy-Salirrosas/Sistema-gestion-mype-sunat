import { ExportPleTxtUseCase } from '../../../src/modules/accounting/application/use-cases/exportPleTxtUseCase';
import { AccountingEntryEntity } from '../../../src/modules/accounting/domain/entities/accountingEntryEntity';

describe('ExportPleTxtUseCase', () => {
  let useCase: ExportPleTxtUseCase;

  beforeEach(() => {
    useCase = new ExportPleTxtUseCase();
  });

  it('debe generar el contenido TXT oficial delimitado por pipes', async () => {
    const entry = new AccountingEntryEntity({
      companyId: 'comp-1',
      period: '2026-03',
      entryNumber: 1,
      entryDate: new Date('2026-03-01'),
      glosa: 'Venta del periodo',
      sourceModule: 'INVOICES',
      lines: [
        {
          lineOrder: 1,
          accountCode: '1212',
          accountName: 'Cuentas por cobrar',
          debitAmount: 118,
          creditAmount: 0,
        },
        {
          lineOrder: 2,
          accountCode: '70121',
          accountName: 'Ventas',
          debitAmount: 0,
          creditAmount: 118,
        },
      ],
    });

    const result = await useCase.execute(
      {
        companyId: 'comp-1',
        companyRuc: '20100070970',
        year: 2026,
        month: 3,
        bookCode: '050100',
      },
      [entry],
    );

    expect(result.recordsCount).toBe(2);
    expect(result.totalDebit).toBe(118);
    expect(result.totalCredit).toBe(118);
    expect(result.content).toContain('20260300|001-202603-001|M001|1212|118.00|0.00|Venta del periodo|1|');
  });

  it('debe generar archivo vacío con indicador 0 cuando no hay registros', async () => {
    const result = await useCase.execute({
      companyId: 'comp-1',
      companyRuc: '20100070970',
      year: 2026,
      month: 3,
      bookCode: '050100',
    });

    expect(result.recordsCount).toBe(0);
    expect(result.content).toBe('');
  });
});