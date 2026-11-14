import { ExportPleTxtUseCase } from '../../../src/modules/accounting/application/use-cases/exportPleTxtUseCase';

describe('ExportPleTxtUseCase', () => {
  let useCase: ExportPleTxtUseCase;

  const mockEntries: any[] = [
    {
      id: 'entry-1',
      entryNumber: '001-202603-001', // Caso 1: CUO formateado
      entryDate: new Date('2026-03-15T00:00:00Z'),
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
      companyRuc: '20100070970',
      year: 2026,
      month: 3,
      bookCode: '050100',
    };

    const result = await useCase.execute(dto as any, mockEntries);

    expect(result).toBeDefined();
    expect(result.recordsCount).toBe(5); // 3 líneas de entry-1 + 2 líneas de entry-2
    expect(result.totalDebit).toBe(168);
    expect(result.totalCredit).toBe(168);
    const primera = result.content.split('\r\n')[0].split('|');
    expect(primera[3]).toBe('1212'); // cuenta contable
    expect(primera[17]).toBe('118.00'); // debe
    expect(primera[18]).toBe('0.00'); // haber
    expect(typeof result.fileName).toBe('string');
  });

  it('emite las 21 columnas del formato 5.1', async () => {
    const result = await useCase.execute(
      { companyRuc: '20100070970', year: 2026, month: 3, bookCode: '050100' } as any,
      [mockEntries[0]],
    );

    const columnas = result.content.split('\r\n')[0].split('|');
    // Se descarta el último elemento, que es la tubería final.
    expect(columnas.slice(0, -1)).toHaveLength(21);
    const [periodo, cuo, correlativo, cuenta, , , moneda, , , , , , fecha, , , glosa, , debe, haber, , estado] = columnas;
    expect(periodo).toBe('20260300');
    expect(cuo).toBe('001-202603-001');
    expect(correlativo).toMatch(/^M\d{3}$/);
    expect(cuenta).toBe('1212');
    expect(moneda).toBe('PEN');
    expect(fecha).toBe('15/03/2026');
    expect(glosa).toBe('Venta de mercadería');
    expect(debe).toBe('118.00');
    expect(haber).toBe('0.00');
    expect(estado).toBe('1');
  });

  it('debe generar la estructura vacía cuando el arreglo de asientos es vacío', async () => {
    const dto = {
      companyRuc: '20100070970',
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

  it('genera el libro 3.1 con saldos por cuenta', async () => {
    const result = await useCase.execute({
      companyRuc: '20100070970', year: 2026, month: 3, bookCode: '030100',
    } as any, mockEntries);
    expect(result.recordsCount).toBe(5);
    expect(result.content).toContain('101|');
    expect(result.totalDebit).toBe(168);
  });

  it('sanea la glosa para que una tubería no corra las columnas', async () => {
    const entrada: any = {
      id: 'e1',
      entryNumber: 1,
      glosa: 'Venta|con tubería\ny salto',
      lines: [
        { lineOrder: 1, accountCode: '12121', debitAmount: 118, creditAmount: 0 },
        { lineOrder: 2, accountCode: '70121', debitAmount: 0, creditAmount: 118 },
      ],
    };
    const result = await useCase.execute(
      { companyRuc: '20100070970', year: 2026, month: 3, bookCode: '050100' } as any,
      [entrada],
    );
    expect(result.content).toContain('Venta con tubería y salto');
    expect(result.content).not.toContain('Venta|con');
  });

  it('rechaza un RUC de emisor con dígito verificador inválido', async () => {
    await expect(
      useCase.execute({ companyRuc: '20601234567', year: 2026, month: 3, bookCode: '050100' } as any, mockEntries),
    ).rejects.toThrow('módulo 11');
  });
});