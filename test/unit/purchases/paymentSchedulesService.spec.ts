import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentSchedulesService } from '../../../src/modules/purchases/application/services/paymentSchedulesService';

const compra = (over: Record<string, any> = {}) => ({ id: 'p1', purchase_number: 'COM-1', supplier_name: 'Proveedor', supplier_doc_number: '20100070970', document_serial: 'F001', document_number: '1', issue_date: new Date('2026-11-01'), due_date: new Date('2026-11-20'), total_amount: 118, paid_amount: 0, credit_amount: 0, status: 'REGISTRADA', payment_schedules: [{ id: 's1', purchase_id: 'p1', scheduled_date: new Date('2026-11-25'), amount: 50, status: 'PROGRAMADO', notes: null, paid_at: null, created_at: new Date() }], ...over });
function setup(over: Record<string, any> = {}) {
  const prisma: any = {
    nationalPurchase: { findMany: jest.fn().mockResolvedValue([compra()]), findFirst: jest.fn().mockResolvedValue(compra()), update: jest.fn().mockResolvedValue({}) },
    purchasePaymentSchedule: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50 } }),
      create: jest.fn(async ({ data }: any) => ({ id: 's2', ...data, status: 'PROGRAMADO' })),
      findFirst: jest.fn().mockResolvedValue({ id: 's1', status: 'PROGRAMADO' }),
      update: jest.fn(async ({ data }: any) => ({ id: 's1', ...data })),
    },
    ...over,
  };
  return { prisma, service: new PaymentSchedulesService(prisma) };
}

describe('PaymentSchedulesService', () => {
  it('arma resumen con saldo, programado y vencido', async () => {
    const { service } = setup();
    const r = await service.list('c1');
    expect(r.summary).toMatchObject({ totalBalance: 118, scheduled: 50 });
    expect(r.purchases[0]).toMatchObject({ balance: 118, availableToSchedule: 68 });
  });

  it('programa un pago dentro del saldo disponible', async () => {
    const { prisma, service } = setup();
    await expect(service.create('c1', { purchaseId: 'p1', scheduledDate: '2026-11-30', amount: 68 })).resolves.toMatchObject({ amount: 68, status: 'PROGRAMADO' });
    expect(prisma.purchasePaymentSchedule.create).toHaveBeenCalled();
  });

  it('rechaza compra inexistente, anulada o importe mayor al disponible', async () => {
    const no = setup(); no.prisma.nationalPurchase.findFirst.mockResolvedValue(null);
    await expect(no.service.create('c1', { purchaseId: 'p1', scheduledDate: '2026-11-30', amount: 1 })).rejects.toBeInstanceOf(NotFoundException);
    const anulada = setup(); anulada.prisma.nationalPurchase.findFirst.mockResolvedValue(compra({ status: 'ANULADA' }));
    await expect(anulada.service.create('c1', { purchaseId: 'p1', scheduledDate: '2026-11-30', amount: 1 })).rejects.toThrow('anulada');
    const excedido = setup();
    await expect(excedido.service.create('c1', { purchaseId: 'p1', scheduledDate: '2026-11-30', amount: 100 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('anula solo programaciones pendientes', async () => {
    const { prisma, service } = setup();
    await expect(service.cancel('c1', 's1')).resolves.toMatchObject({ status: 'ANULADO' });
    prisma.purchasePaymentSchedule.findFirst.mockResolvedValueOnce({ id: 's1', status: 'PAGADO' });
    await expect(service.cancel('c1', 's1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('actualiza vencimiento y valida fecha', async () => {
    const { prisma, service } = setup();
    await expect(service.updateDueDate('c1', 'p1', '2026-12-01')).resolves.toMatchObject({ purchaseId: 'p1' });
    expect(prisma.nationalPurchase.update).toHaveBeenCalled();
    await expect(service.updateDueDate('c1', 'p1', 'no-fecha')).rejects.toBeInstanceOf(BadRequestException);
  });
});
