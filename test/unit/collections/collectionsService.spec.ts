import { BadRequestException } from '@nestjs/common';
import { CollectionsService } from '../../../src/modules/collections/application/services/collectionsService';

describe('CollectionsService', () => {
  it('registra cobro y asiento 10/12', async () => {
    const prisma = {
      collection: { create: jest.fn().mockResolvedValue({ id: 'c1', customer_name: 'Cliente' }) },
      accountingRule: { findMany: jest.fn().mockResolvedValue([{ line_order: 1, account_code: '1041' }, { line_order: 2, account_code: '12121' }]) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new CollectionsService(prisma as never, accounting as never);
    await expect(service.create('co1', { customerName: 'Cliente', amount: 118 })).resolves.toMatchObject({ id: 'c1' });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceModule: 'COLLECTIONS', lines: expect.arrayContaining([expect.objectContaining({ accountCode: '1041', debitAmount: 118 })]) }));
  });

  it('rechaza monto inválido y falta de reglas', async () => {
    const prisma = { collection: { create: jest.fn() }, accountingRule: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new CollectionsService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.create('co1', { customerName: 'Cliente', amount: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('co1', { customerName: 'Cliente', amount: 10 })).rejects.toThrow('Las reglas COBRO están incompletas');
  });

  it('valida comprobante y saldo del cobro', async () => {
    const prisma = {
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'i1', monto_total: 118, estado: 'ACEPTADO' }), aggregate: jest.fn().mockResolvedValue({ _sum: { monto_total: 0 } }) },
      collection: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 18 } }), create: jest.fn() },
      accountingRule: { findMany: jest.fn() },
    };
    const service = new CollectionsService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.create('c1', { customerName: 'Cliente', invoiceNumber: 'F001-00000001', amount: 200 })).rejects.toThrow('supera el saldo');
    prisma.invoice.findFirst.mockResolvedValue(null);
    await expect(service.create('c1', { customerName: 'Cliente', invoiceNumber: 'F001-00000001', amount: 10 })).rejects.toThrow('no existe');
  });

  it('lista facturas con saldo pendiente', async () => {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([{ id: 'i1', serie: 'F001', correlativo: 1, customer_legal_name: 'Cliente', customer_identity_number: '20100070970', monto_total: 118, fecha_emision: new Date('2026-11-10') }]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto_total: 18 } }),
      },
      collection: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 18 } }) },
    };
    const service = new CollectionsService(prisma as never, { execute: jest.fn() } as never);
    await expect(service.listReceivables('c1')).resolves.toEqual([expect.objectContaining({ numero: 'F001-00000001', total: 118, credited: 18, paid: 18, balance: 82 })]);
  });

  it('anula cobro con contra-asiento', async () => {
    const prisma = {
      collection: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', customer_name: 'Cliente', status: 'REGISTRADO' }), update: jest.fn().mockResolvedValue({ id: 'c1', status: 'ANULADO' }) },
      accountingEntry: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', lines: [{ account_code: '1041', account_name: 'Banco', debit_amount: 100, credit_amount: 0 }, { account_code: '12121', account_name: 'CxC', debit_amount: 0, credit_amount: 100 }] }) },
      treasuryMovement: { create: jest.fn().mockResolvedValue({ id: 'tm1' }) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const service = new CollectionsService(prisma as never, accounting as never);
    await expect(service.annul('c1', 'c1')).resolves.toMatchObject({ status: 'ANULADO' });
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({ sourceReferenceId: 'ANUL-c1', lines: expect.arrayContaining([expect.objectContaining({ accountCode: '1041', creditAmount: 100 })]) }));
  });

  it('arma estado de cuenta por cliente', async () => {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([{ id: 'i1', serie: 'F001', correlativo: 1, monto_total: 118, fecha_emision: new Date('2026-11-10') }]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto_total: 18 } }),
      },
      collection: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50 } }),
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', collection_date: new Date('2026-11-10'), invoice_number: 'F001-00000001', amount: 50, payment_method: 'TRANSFERENCIA' }]),
      },
    };
    const service = new CollectionsService(prisma as never, { execute: jest.fn() } as never);
    const r = await service.customerStatement('co1', '20100070970');
    expect(r.totals).toEqual({ total: 118, credited: 18, paid: 50, balance: 50 });
    expect(r.invoices).toHaveLength(1);
    expect(r.aging.d0_30).toBe(50);
    expect(r.collections).toHaveLength(1);
  });

  it('consolida cartera y principales deudores', async () => {
    const prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', customer_identity_number: '20100070970', customer_legal_name: 'Cliente', monto_total: 118, fecha_emision: new Date('2026-10-01') }]), aggregate: jest.fn().mockResolvedValue({ _sum: { monto_total: 0 } }) },
      collection: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 18 } }) },
    };
    const service = new CollectionsService(prisma as never, { execute: jest.fn() } as never);
    const r = await service.portfolioAging('c1');
    expect(r.total).toBe(100);
    expect(r.invoiceCount).toBe(1);
    expect(r.debtors[0]).toMatchObject({ doc: '20100070970', balance: 100 });
    expect(r.aging.d31_60 + r.aging.d61_90 + r.aging.d90_plus + r.aging.d0_30).toBe(100);
    expect(r.overdue).toEqual({ count: 1, total: 100 });
  });

  it('lista cobros de una factura', async () => {
    const prisma = {
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'i1', serie: 'F001', correlativo: 1, customer_legal_name: 'Cliente', monto_total: 118, fecha_emision: new Date('2026-11-10') }) },
      collection: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', collection_date: new Date('2026-11-10'), amount: 50, payment_method: 'TRANSFERENCIA', bank_name: 'BCP', status: 'REGISTRADO' }]) },
    };
    const service = new CollectionsService(prisma as never, { execute: jest.fn() } as never);
    const r = await service.invoiceCollections('co1', 'i1');
    expect(r.invoice.numero).toBe('F001-00000001');
    expect(r.paid).toBe(50);
    expect(r.collections).toHaveLength(1);
  });
});
