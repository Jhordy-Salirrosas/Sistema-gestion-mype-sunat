import { BadRequestException } from '@nestjs/common';
import { GenerateClosingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateClosingEntryUseCase';

/** Asiento con forma de fila de Prisma, ya balanceado. */
const asiento = (
  entryNumber: number,
  lineas: Array<{ code: string; name: string; debe?: number; haber?: number }>,
) => ({
  entry_number: entryNumber,
  period: '2026-11',
  lines: lineas.map((l) => ({
    account_code: l.code,
    account_name: l.name,
    debit_amount: l.debe ?? 0,
    credit_amount: l.haber ?? 0,
  })),
});

/** Ejercicio mínimo: una venta y una compra, ambas cuadradas. */
const ejercicioCuadrado = () => [
  asiento(1, [
    { code: '12121', name: 'CxC', debe: 1180 },
    { code: '70121', name: 'Ventas', haber: 1000 },
    { code: '40111', name: 'IGV', haber: 180 },
  ]),
  asiento(2, [
    { code: '60111', name: 'Compras', debe: 600 },
    { code: '42121', name: 'CxP', haber: 600 },
  ]),
];

describe('GenerateClosingEntryUseCase', () => {
  it('cierra ingresos y gastos contra resultados acumulados', async () => {
    const prisma = {
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(ejercicioCuadrado()),
      },
      accountingRule: { findFirst: jest.fn().mockResolvedValue(null) },
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

  it('rechaza cerrar un ejercicio con asientos descuadrados', async () => {
    const prisma = {
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          asiento(7, [
            { code: '12121', name: 'CxC', debe: 118 },
            { code: '70121', name: 'Ventas', haber: 100 },
          ]),
        ]),
      },
      accountingRule: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const generar = { execute: jest.fn() };

    await expect(
      new GenerateClosingEntryUseCase(prisma as never, generar as never).execute('c1', 2026),
    ).rejects.toThrow('el asiento 7 del período 2026-11 está descuadrado');
    expect(generar.execute).not.toHaveBeenCalled();
  });

  it('usa la subcuenta configurada en la regla CIERRE cuando existe', async () => {
    const prisma = {
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(ejercicioCuadrado()),
      },
      accountingRule: {
        findFirst: jest.fn().mockResolvedValue({
          account_code: '5911',
          description: 'Utilidades acumuladas',
        }),
      },
    };
    const generar = { execute: jest.fn().mockResolvedValue({ id: 'entry-1' }) };

    const resultado = await new GenerateClosingEntryUseCase(prisma as never, generar as never).execute('c1', 2026);

    expect(resultado.cuentaCierre).toBe('5911');
    expect(generar.execute).toHaveBeenCalledWith(expect.objectContaining({
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '5911', accountName: 'Utilidades acumuladas' }),
      ]),
    }));
  });

  it('sin regla CIERRE cierra contra 59', async () => {
    const prisma = {
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          asiento(1, [
            { code: '12121', name: 'CxC', debe: 100 },
            { code: '70121', name: 'Ventas', haber: 100 },
          ]),
        ]),
      },
      accountingRule: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const generar = { execute: jest.fn().mockResolvedValue({ id: 'entry-1' }) };

    const resultado = await new GenerateClosingEntryUseCase(prisma as never, generar as never).execute('c1', 2026);

    expect(resultado.cuentaCierre).toBe('59');
  });
});
