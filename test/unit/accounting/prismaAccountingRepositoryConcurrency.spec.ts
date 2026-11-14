import { BadRequestException } from '@nestjs/common';
import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { AccountingEntryEntity } from '../../../src/modules/accounting/domain/entities/accountingEntryEntity';

const entrada = (over: Partial<{ idempotencyKey: string; entryNumber: number }> = {}) =>
  new AccountingEntryEntity({
    companyId: 'c1',
    period: '2026-11',
    entryNumber: over.entryNumber ?? 7,
    entryDate: new Date('2026-11-10T00:00:00Z'),
    glosa: 'Venta',
    sourceModule: 'INVOICES',
    idempotencyKey: over.idempotencyKey,
    lines: [
      { lineOrder: 1, accountCode: '12121', accountName: 'CxC', debitAmount: 118, creditAmount: 0 },
      { lineOrder: 2, accountCode: '70121', accountName: 'Ventas', debitAmount: 0, creditAmount: 118 },
    ],
  });

const conflicto = (target: string) => Object.assign(new Error('Unique constraint failed'), {
  code: 'P2002',
  meta: { target },
});

/** `findFirst` sirve para dos cosas: numerar y buscar por clave de idempotencia. */
const crearPrisma = (opciones: { ultimoNumero?: number | null; existente?: any } = {}) => ({
  accountingEntry: {
    create: jest.fn(),
    findFirst: jest.fn(async (args: any) => {
      if (args?.include) return opciones.existente ?? null;
      return opciones.ultimoNumero === null
        ? null
        : { entry_number: opciones.ultimoNumero ?? 7 };
    }),
  },
});

describe('PrismaAccountingRepository · numeración concurrente', () => {
  it('reintenta con el siguiente número cuando otra emisión tomó el suyo', async () => {
    const prisma = crearPrisma({ ultimoNumero: 7 });
    prisma.accountingEntry.create
      .mockRejectedValueOnce(conflicto('accounting_entries_company_id_period_entry_number_key'))
      .mockResolvedValueOnce({ id: 'e-8' });

    const r = await new PrismaAccountingRepository(prisma as never).saveEntry(entrada());

    expect(prisma.accountingEntry.create).toHaveBeenCalledTimes(2);
    expect(prisma.accountingEntry.create.mock.calls[0][0].data.entry_number).toBe(7);
    expect(prisma.accountingEntry.create.mock.calls[1][0].data.entry_number).toBe(8);
    expect(r.entryNumber).toBe(8);
    expect(r.id).toBe('e-8');
  });

  it('trata como colisión de numeración un conflicto sin detalle del índice', async () => {
    const prisma = crearPrisma({ ultimoNumero: null });
    prisma.accountingEntry.create
      .mockRejectedValueOnce(conflicto(''))
      .mockResolvedValueOnce({ id: 'e-1' });

    const r = await new PrismaAccountingRepository(prisma as never).saveEntry(entrada());

    expect(r.entryNumber).toBe(1);
    expect(prisma.accountingEntry.create).toHaveBeenCalledTimes(2);
  });

  it('se rinde con un mensaje accionable tras tres colisiones seguidas', async () => {
    const prisma = crearPrisma({ ultimoNumero: 5 });
    prisma.accountingEntry.create.mockRejectedValue(conflicto('entry_number'));

    await expect(new PrismaAccountingRepository(prisma as never).saveEntry(entrada())).rejects.toThrow(
      BadRequestException,
    );
    await expect(new PrismaAccountingRepository(prisma as never).saveEntry(entrada())).rejects.toThrow(
      'reintente el registro',
    );
    expect(prisma.accountingEntry.create).toHaveBeenCalledTimes(6);
  });

  it('devuelve el asiento existente cuando el conflicto es de idempotencia', async () => {
    const prisma = crearPrisma({
      existente: {
        id: 'e-previo',
        company_id: 'c1',
        period: '2026-11',
        entry_number: 3,
        entry_date: new Date('2026-11-10T00:00:00Z'),
        glosa: 'Venta original',
        source_module: 'INVOICES',
        source_reference_id: 'inv-1',
        idempotency_key: 'm1:invoice:inv-1',
        lines: [
          { line_order: 1, account_code: '12121', account_name: 'CxC', debit_amount: 118, credit_amount: 0 },
          { line_order: 2, account_code: '70121', account_name: 'Ventas', debit_amount: 0, credit_amount: 118 },
        ],
      },
    });
    prisma.accountingEntry.create.mockRejectedValue(
      conflicto('accounting_entries_company_id_idempotency_key_key'),
    );

    const r = await new PrismaAccountingRepository(prisma as never).saveEntry(
      entrada({ idempotencyKey: 'm1:invoice:inv-1' }),
    );

    expect(r.id).toBe('e-previo');
    expect(prisma.accountingEntry.create).toHaveBeenCalledTimes(1);
  });

  it('no reintenta errores que no son de unicidad', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.create.mockRejectedValue(new Error('conexión perdida'));

    await expect(new PrismaAccountingRepository(prisma as never).saveEntry(entrada())).rejects.toThrow(
      'conexión perdida',
    );
    expect(prisma.accountingEntry.create).toHaveBeenCalledTimes(1);
  });

  it('guarda los totales y el balance calculados de las líneas', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.create.mockResolvedValue({ id: 'e-ok' });

    await new PrismaAccountingRepository(prisma as never).saveEntry(entrada());

    const data = prisma.accountingEntry.create.mock.calls[0][0].data;
    expect(data.total_debit).toBe(118);
    expect(data.total_credit).toBe(118);
    expect(data.is_balanced).toBe(true);
    expect(data.lines.create).toHaveLength(2);
  });
});
