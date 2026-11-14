import { Prisma } from '../../../src/generated/client/client';
import { BadRequestException } from '@nestjs/common';
import { InvoiceDetractionService } from '../../../src/modules/invoices/application/services/invoiceDetractionService';

function transactional(prisma: any) {
 prisma.invoiceDetractionDeposit = { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(async ({data}: any) => ({...data, id: 'deposit', created_at: new Date('2026-11-01')})), update: jest.fn(async ({data}: any) => ({...data, id: 'old', created_at: new Date('2026-11-01')})) };
 prisma.$queryRaw = jest.fn(); prisma.transactionHistory = { create: jest.fn() }; prisma.$transaction = async (fn: any) => fn(prisma); return prisma;
}

describe('InvoiceDetractionService', () => {
  it('lista solo comprobantes con detracción', async () => {
    const prisma = { invoice: { findMany: jest.fn().mockResolvedValue([
      { id: 'i1', serie: 'F001', correlativo: 1, fecha_emision: new Date('2026-11-10'), customer_legal_name: 'Cliente', monto_total: 1180, payload_ubl: { montoDetraccion: 118 }, detraccion_deposited_at: null, detraccion_deposited_amount: null, detraccion_constancia: null },
      { id: 'i2', serie: 'F001', correlativo: 2, fecha_emision: new Date('2026-11-10'), customer_legal_name: 'Cliente', monto_total: 118, payload_ubl: {}, detraccion_deposited_at: null, detraccion_deposited_amount: null, detraccion_constancia: null },
    ]) } };
    const r = await new InvoiceDetractionService(transactional(prisma) as never).list('c1', '2026-11');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'i1', detraction: 118 });
  });

  it('registra depósito y valida monto', async () => {
    const prisma = { invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'i1', estado: 'ACEPTADO', payload_ubl: { montoDetraccion: 118 } }), update: jest.fn().mockResolvedValue({ id: 'i1' }) } };
    const service = new InvoiceDetractionService(transactional(prisma) as never);
    await expect(service.registerDeposit('c1', 'i1', { amount: 118, date: '2026-11-10', constancia: '001' })).resolves.toMatchObject({ id: 'i1' });
    await expect(service.registerDeposit('c1', 'i1', { amount: 200 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('depósitos: precisión y fecha estrictas', () => {
  const factura = { id: 'i1', estado: 'ACEPTADO', payload_ubl: { montoDetraccion: 118 } };
  const update = jest.fn().mockResolvedValue({ id: 'i1' });
  const service = new InvoiceDetractionService(transactional({ invoice: { findFirst: jest.fn().mockResolvedValue(factura), update } }) as never);
  beforeEach(() => update.mockClear());
  it.each([-1, 0, 1.001, 118.001, 119, NaN, Infinity])('rechaza monto %s sin escritura', async amount => {
    await expect(service.registerDeposit('c1', 'i1', { amount })).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
  it.each(['', '2026-02-30', '2026-13-01', '2026-2-01', 'no-fecha'])('rechaza fecha %s', async date => {
    await expect(service.registerDeposit('c1', 'i1', { amount: 1.23, date })).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
  it.each(['2024-02-29', '2020-01-01', '2099-12-31'])('admite fecha válida sin nueva restricción temporal %s', async date => {
    await service.registerDeposit('c1', 'i1', { amount: 1.23, date, constancia: ' 001 ' });
    expect(update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { detraccion_deposited_at: new Date(`${date}T00:00:00Z`), detraccion_deposited_amount: new Prisma.Decimal(1.23), detraccion_constancia: '001' } });
  });
});

 describe('constancia de nuevos guardados', () => {
  it.each(['ABC', '12-3', '1 2', '１２', 123])('rechaza %s sin escritura', async constancia => {
   const update = jest.fn();
   const service = new InvoiceDetractionService({ invoice: { update } } as never);
   await expect(service.registerDeposit('c', 'i', { constancia } as never)).rejects.toThrow('La constancia debe contener solo dígitos o quedar vacía.');
   expect(update).not.toHaveBeenCalled();
  });
 });

 it('registra valores anteriores/nuevos y actor sin cambiar estado fiscal', async () => {
  const prisma = transactional({ invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'i', estado: 'ACEPTADO', payload_ubl: { montoDetraccion: 118 }, detraccion_deposited_at: new Date('2026-11-01'), detraccion_deposited_amount: 10, detraccion_constancia: 'ABC' }), update: jest.fn().mockResolvedValue({ id: 'i' }) } });
  prisma.invoiceDetractionDeposit.findMany.mockResolvedValue([{ id: 'old', date: new Date('2026-11-01'), amount: 10, constancia: 'ABC', created_at: new Date('2026-11-01') }]);
  await new InvoiceDetractionService(prisma).registerDeposit('c', 'i', { amount: 20, date: '2026-11-02', constancia: '002' }, 'usuario', 'old');
  const event = prisma.transactionHistory.create.mock.calls[0][0].data;
  expect(event).toMatchObject({ company_id: 'c', invoice_id: 'i', intento: 0, estado_anterior: 'ACEPTADO', estado_nuevo: 'ACEPTADO', codigo_error: 'M1_DETRACTION_DEPOSIT' });
  expect(JSON.parse(event.mensaje_error)).toMatchObject({ actor: 'usuario', anterior: { monto: 10, constancia: 'ABC' }, nuevo: { monto: 20, constancia: '002' } });
 });
