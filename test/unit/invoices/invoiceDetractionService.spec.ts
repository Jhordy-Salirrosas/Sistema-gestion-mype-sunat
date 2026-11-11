import { BadRequestException } from '@nestjs/common';
import { InvoiceDetractionService } from '../../../src/modules/invoices/application/services/invoiceDetractionService';

describe('InvoiceDetractionService', () => {
  it('lista solo comprobantes con detracción', async () => {
    const prisma = { invoice: { findMany: jest.fn().mockResolvedValue([
      { id: 'i1', serie: 'F001', correlativo: 1, fecha_emision: new Date('2026-11-10'), customer_legal_name: 'Cliente', monto_total: 1180, payload_ubl: { montoDetraccion: 118 }, detraccion_deposited_at: null, detraccion_deposited_amount: null, detraccion_constancia: null },
      { id: 'i2', serie: 'F001', correlativo: 2, fecha_emision: new Date('2026-11-10'), customer_legal_name: 'Cliente', monto_total: 118, payload_ubl: {}, detraccion_deposited_at: null, detraccion_deposited_amount: null, detraccion_constancia: null },
    ]) } };
    const r = await new InvoiceDetractionService(prisma as never).list('c1', '2026-11');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'i1', detraction: 118 });
  });

  it('registra depósito y valida monto', async () => {
    const prisma = { invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'i1', estado: 'ACEPTADO', payload_ubl: { montoDetraccion: 118 } }), update: jest.fn().mockResolvedValue({ id: 'i1' }) } };
    const service = new InvoiceDetractionService(prisma as never);
    await expect(service.registerDeposit('c1', 'i1', { amount: 118, date: '2026-11-10', constancia: '001' })).resolves.toMatchObject({ id: 'i1' });
    await expect(service.registerDeposit('c1', 'i1', { amount: 200 })).rejects.toBeInstanceOf(BadRequestException);
  });
});
