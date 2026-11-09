import { BadRequestException } from '@nestjs/common';
import { GenerateClosingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateClosingEntryUseCase';

describe('GenerateClosingEntryUseCase', () => {
  it('cierra ingresos y gastos contra resultados acumulados', async () => {
    const prisma = {
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          { lines: [
            { account_code: '70121', account_name: 'Ventas', debit_amount: 0, credit_amount: 1000 },
            { account_code: '60111', account_name: 'Compras', debit_amount: 600, credit_amount: 0 },
            { account_code: '12121', account_name: 'CxC', debit_amount: 1180, credit_amount: 0 },
          ] },
        ]),
      },
    };
    const generar = { execute: jest.fn().mockResolvedValue({ id: 'entry-1' }) };
    const useCase = new GenerateClosingEntryUseCase(prisma as never, generar as never);
    const resultado = await useCase.execute('c1', 2026);
    expect(resultado.resultado).toBe(400);
    expect(generar.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceModule: 'CLOSING',
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '70121', debitAmount: 1000 }),
        expect.objectContaining({ accountCode: '60111', creditAmount: 600 }),
        expect.objectContaining({ accountCode: '59', debitAmount: 600 }),
        expect.objectContaining({ accountCode: '59', creditAmount: 1000 }),
      ]),
    }));
  });

  it('rechaza un cierre duplicado', async () => {
    const prisma = { accountingEntry: { findFirst: jest.fn().mockResolvedValue({ id: 'x' }) } };
    const useCase = new GenerateClosingEntryUseCase(prisma as never, { execute: jest.fn() } as never);
    await expect(useCase.execute('c1', 2026)).rejects.toBeInstanceOf(BadRequestException);
  });
});
