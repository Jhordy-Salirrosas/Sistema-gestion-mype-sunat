import { CollectionsService } from '../../../src/modules/collections/application/services/collectionsService';

/**
 * Reverso del cobro cuando la venta se anula (observación 4): el dinero no
 * puede quedar como cobrado si el comprobante ya no existe ante SUNAT.
 */
describe('CollectionsService · anular los cobros de un comprobante anulado', () => {
  const crearPrisma = (over: Record<string, any> = {}) => ({
    invoice: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'inv-1', serie: 'F001', correlativo: 5, estado: 'ANULADO',
      }),
    },
    collection: {
      findMany: jest.fn().mockResolvedValue([{ id: 'cob-1' }, { id: 'cob-2' }]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'cob-1', invoice_number: 'F001-00000005', customer_name: 'Cliente SAC',
        amount: 118, payment_method: 'TRANSFERENCIA', bank_name: 'BCP', status: 'REGISTRADO',
      }),
      update: jest.fn().mockResolvedValue({ id: 'cob-1', status: 'ANULADO' }),
    },
    accountingEntry: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'e1',
        lines: [
          { account_code: '1041', account_name: 'Banco', debit_amount: 118, credit_amount: 0 },
          { account_code: '12121', account_name: 'CxC', debit_amount: 0, credit_amount: 118 },
        ],
      }),
    },
    treasuryMovement: { create: jest.fn().mockResolvedValue({ id: 'mov-1' }) },
    ...over,
  });

  it('anula todos los cobros vivos del comprobante', async () => {
    const prisma = crearPrisma();
    const accounting = { execute: jest.fn().mockResolvedValue({}) };

    const r = await new CollectionsService(prisma as never, accounting as never).annulByInvoice('c1', 'inv-1');

    expect(r).toMatchObject({ comprobante: 'F001-00000005', cobros: 2, anulados: 2, fallidos: [] });
    expect(prisma.collection.update).toHaveBeenCalledTimes(2);
    expect(accounting.execute).toHaveBeenCalledTimes(2);
  });

  it('rechaza un comprobante que no está anulado', async () => {
    const prisma = crearPrisma({
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', serie: 'F001', correlativo: 5, estado: 'ACEPTADO' }) },
    });

    await expect(
      new CollectionsService(prisma as never, { execute: jest.fn() } as never).annulByInvoice('c1', 'inv-1'),
    ).rejects.toThrow('comprobante ANULADO');
    expect(prisma.collection.update).not.toHaveBeenCalled();
  });

  it('rechaza un comprobante inexistente', async () => {
    const prisma = crearPrisma({ invoice: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(
      new CollectionsService(prisma as never, { execute: jest.fn() } as never).annulByInvoice('c1', 'no'),
    ).rejects.toThrow('Comprobante no encontrado');
  });

  it('no frena la reversión si un cobro falla', async () => {
    const prisma = crearPrisma();
    // El primer cobro no tiene asiento: annul lanza y debe quedar en fallidos.
    prisma.accountingEntry.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'e2',
        lines: [
          { account_code: '1041', account_name: 'Banco', debit_amount: 50, credit_amount: 0 },
          { account_code: '12121', account_name: 'CxC', debit_amount: 0, credit_amount: 50 },
        ],
      });

    const r = await new CollectionsService(prisma as never, { execute: jest.fn().mockResolvedValue({}) } as never)
      .annulByInvoice('c1', 'inv-1');

    expect(r.anulados).toBe(1);
    expect(r.fallidos).toHaveLength(1);
    expect(r.fallidos[0].motivo).toContain('no tiene asiento');
  });
});
