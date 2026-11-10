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
    await expect(service.create('co1', { customerName: 'Cliente', amount: 10 })).rejects.toThrow('No hay reglas contables para COBRO');
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
});
