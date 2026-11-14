import { BadRequestException, ConflictException } from '@nestjs/common';
import { CashClosuresService } from '../../../src/modules/sales/application/services/cashClosuresService';

const row = (over: Record<string, any> = {}) => ({ id: 'c1', closure_date: new Date('2026-11-14'), sales_total: 1000, collections_total: 500, cash_collections: 300, cash_expenses: 50, expected_cash: 250, counted_cash: 250, difference: 0, details: {}, notes: null, status: 'CERRADA', created_at: new Date(), ...over });

function setup() {
  const prisma: any = {
    invoice: { aggregate: jest.fn().mockResolvedValue({ _sum: { monto_total: 1000 } }) },
    collection: { groupBy: jest.fn().mockResolvedValue([{ payment_method: 'EFECTIVO', _sum: { amount: 300 } }, { payment_method: 'TRANSFERENCIA', _sum: { amount: 200 } }]) },
    treasuryMovement: { groupBy: jest.fn().mockResolvedValue([{ payment_method: 'EFECTIVO', _sum: { amount: 50 } }]) },
    cashClosure: {
      findMany: jest.fn().mockResolvedValue([row()]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(row()),
    },
  };
  return { prisma, service: new CashClosuresService(prisma) };
}

describe('CashClosuresService', () => {
  it('calcula resumen diario y efectivo esperado', async () => {
    const { service } = setup();
    const r = await service.summary('c1', '2026-11-14');
    expect(r).toMatchObject({ salesTotal: 1000, collectionsTotal: 500, cashCollections: 300, cashExpenses: 50, expectedCash: 250 });
    expect(r.collectionsByMethod).toHaveLength(2);
  });

  it('lista cierres y mapea importes', async () => {
    const { service } = setup();
    await expect(service.list('c1')).resolves.toEqual([expect.objectContaining({ id: 'c1', expectedCash: 250, difference: 0 })]);
  });

  it('cierra caja con conteo y diferencia', async () => {
    const { prisma, service } = setup();
    await expect(service.close('c1', { date: '2026-11-14', countedCash: 240 })).resolves.toMatchObject({ id: 'c1' });
    expect(prisma.cashClosure.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ counted_cash: 240, difference: -10 }) }));
  });

  it('rechaza fecha inválida, conteo negativo y cierre duplicado', async () => {
    const { prisma, service } = setup();
    await expect(service.summary('c1', '14-11-2026')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.close('c1', { date: '2026-11-14', countedCash: -1 })).rejects.toBeInstanceOf(BadRequestException);
    prisma.cashClosure.findUnique.mockResolvedValueOnce(row());
    await expect(service.close('c1', { date: '2026-11-14', countedCash: 0 })).rejects.toBeInstanceOf(ConflictException);
  });
});
