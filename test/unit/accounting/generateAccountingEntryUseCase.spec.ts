import { BadRequestException } from '@nestjs/common';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import { IAccountingRepositoryPort } from '../../../src/modules/accounting/domain/ports/accountingRepositoryPort';

describe('GenerateAccountingEntryUseCase', () => {
  let useCase: GenerateAccountingEntryUseCase;
  let mockRepository: jest.Mocked<IAccountingRepositoryPort>;

  beforeEach(() => {
    mockRepository = {
      getNextEntryNumber: jest.fn().mockResolvedValue(1),
      saveEntry: jest.fn().mockImplementation(async (entry) => entry),
      findByCompany: jest.fn().mockResolvedValue([]),
      deleteById: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<IAccountingRepositoryPort>;

    useCase = new GenerateAccountingEntryUseCase(mockRepository);
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