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
      findAccounts: jest.fn().mockResolvedValue([
        { code: '1212', parentCode: '12', isActive: true },
        { code: '40111', parentCode: '4011', isActive: true },
        { code: '70121', parentCode: '7012', isActive: true },
        { code: '6012', parentCode: '60', isActive: true },
        { code: '60121', parentCode: '6012', isActive: true },
        { code: '60122', parentCode: '6012', isActive: true },
      ] as never),
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

  it('rechaza una línea con debe y haber a la vez', async () => {
    await expect(useCase.execute({
      companyId: 'company-uuid-1', period: '2026-03', entryDate: '2026-03-10T00:00:00.000Z',
      glosa: 'Asiento inválido', sourceModule: 'MANUAL',
      lines: [{ lineOrder: 1, accountCode: '1212', accountName: 'CxC', debitAmount: 10, creditAmount: 10 }],
    })).rejects.toThrow('registre debe o haber');
  });

  it('rechaza una línea con importe cero', async () => {
    await expect(useCase.execute({
      companyId: 'company-uuid-1', period: '2026-03', entryDate: '2026-03-10T00:00:00.000Z',
      glosa: 'Asiento vacío', sourceModule: 'MANUAL',
      lines: [{ lineOrder: 1, accountCode: '1212', accountName: 'CxC', debitAmount: 0, creditAmount: 0 }],
    })).rejects.toThrow('mayor que cero');
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

  it('rechaza asiento manual en cuenta de mayor con subcuentas', async () => {
    mockRepository.findAccounts.mockResolvedValue([
      { code: '6012', parentCode: null, isActive: true },
      { code: '60121', parentCode: '6012', isActive: true },
      { code: '60122', parentCode: '6012', isActive: true },
    ] as never);
    await expect(useCase.execute({
      companyId: 'company-uuid-1', period: '2026-03', entryDate: '2026-03-10T00:00:00.000Z',
      glosa: 'Asiento manual', sourceModule: 'MANUAL',
      lines: [{ lineOrder: 1, accountCode: '6012', accountName: 'Compras', debitAmount: 10, creditAmount: 0 }],
    })).rejects.toThrow('es de mayor y tiene subcuentas');
  });

  it('rechaza asiento manual en cuenta inactiva', async () => {
    mockRepository.findAccounts.mockResolvedValue([{ code: '60121', parentCode: '6012', isActive: false }] as never);
    await expect(useCase.execute({
      companyId: 'company-uuid-1', period: '2026-03', entryDate: '2026-03-10T00:00:00.000Z',
      glosa: 'Asiento manual', sourceModule: 'MANUAL',
      lines: [{ lineOrder: 1, accountCode: '60121', accountName: 'Compras', debitAmount: 10, creditAmount: 0 }],
    })).rejects.toThrow('está inactiva');
  });

  it('acepta una divisionaria con subdivisionarias opcionales (40111)', async () => {
    // La 40111 "IGV cuenta propia" es la cuenta de posteo de todas las ventas,
    // aunque existan las subdivisionarias 401111 y 401119. Antes se rechazaba
    // como si fuera una cuenta de mayor.
    mockRepository.findAccounts.mockResolvedValue([
      { code: '401', parentCode: '40', isActive: true },
      { code: '4011', parentCode: '401', isActive: true },
      { code: '40111', parentCode: '4011', isActive: true },
      { code: '401111', parentCode: '40111', isActive: true },
      { code: '12121', parentCode: '1212', isActive: true },
      { code: '70121', parentCode: '7012', isActive: true },
    ] as never);

    const asiento = await useCase.execute({
      companyId: 'company-uuid-1', period: '2026-03', entryDate: '2026-03-10T00:00:00.000Z',
      glosa: 'Venta manual con IGV', sourceModule: 'MANUAL',
      lines: [
        { lineOrder: 1, accountCode: '12121', accountName: 'CxC', debitAmount: 118, creditAmount: 0 },
        { lineOrder: 2, accountCode: '70121', accountName: 'Ventas', debitAmount: 0, creditAmount: 100 },
        { lineOrder: 3, accountCode: '40111', accountName: 'IGV', debitAmount: 0, creditAmount: 18 },
      ],
    });

    expect(asiento.getTotalDebit()).toBe(118);
  });
});