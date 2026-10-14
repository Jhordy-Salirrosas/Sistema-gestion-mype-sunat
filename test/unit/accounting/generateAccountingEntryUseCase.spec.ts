import { BadRequestException } from '@nestjs/common';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';

describe('GenerateAccountingEntryUseCase', () => {
  let useCase: GenerateAccountingEntryUseCase;

  beforeEach(() => {
    useCase = new GenerateAccountingEntryUseCase();
  });

  it('debe generar exitosamente un asiento contable cuadrado', async () => {
    const result = await useCase.execute({
      companyId: 'company-uuid-1',
      period: '2026-03',
      entryNumber: 1,
      entryDate: '2026-03-10T00:00:00.000Z',
      glosa: 'Asiento por factura F001-00000001',
      sourceModule: 'INVOICES',
      sourceReferenceId: 'inv-uuid-1',
      lines: [
        {
          lineOrder: 1,
          accountCode: '1212',
          accountName: 'Emitidas en cartera',
          debitAmount: 118,
          creditAmount: 0,
        },
        {
          lineOrder: 2,
          accountCode: '40111',
          accountName: 'IGV Cuenta propia',
          debitAmount: 0,
          creditAmount: 18,
        },
        {
          lineOrder: 3,
          accountCode: '70121',
          accountName: 'Ventas mercaderías',
          debitAmount: 0,
          creditAmount: 100,
        },
      ],
    });

    expect(result).toBeDefined();
    expect(result.getTotalDebit()).toBe(118);
    expect(result.getTotalCredit()).toBe(118);
    expect(result.glosa).toBe('Asiento por factura F001-00000001');
  });

  it('debe fallar si los montos de Debe y Haber no coinciden', async () => {
    await expect(
      useCase.execute({
        companyId: 'company-uuid-1',
        period: '2026-03',
        entryNumber: 1,
        entryDate: '2026-03-10T00:00:00.000Z',
        glosa: 'Asiento descuadrado',
        sourceModule: 'INVOICES',
        lines: [
          {
            lineOrder: 1,
            accountCode: '1212',
            accountName: 'Emitidas en cartera',
            debitAmount: 118,
            creditAmount: 0,
          },
          {
            lineOrder: 2,
            accountCode: '70121',
            accountName: 'Ventas mercaderías',
            debitAmount: 0,
            creditAmount: 100,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
