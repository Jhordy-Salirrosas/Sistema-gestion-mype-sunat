import { BadRequestException } from '@nestjs/common';
import { SalesReportService } from '../../../src/modules/invoices/application/services/salesReportService';

describe('SalesReportService', () => {
  it('calcula ventas, costo y margen', async () => {
    const prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', serie: 'F001', correlativo: 1, fecha_emision: new Date('2026-11-10'), customer_identity_number: '20100070970', customer_legal_name: 'Cliente', monto_total: 1180, taxable_operations: 1000, total_igv: 180 }]) },
      accountingEntry: { findMany: jest.fn().mockResolvedValue([{ source_reference_id: 'i1', lines: [{ account_code: '69111', debit_amount: 600, credit_amount: 0 }] }]) },
    };
    const r = await new SalesReportService(prisma as never).execute('c1', '2026-11-01', '2026-11-30');
    expect(r.totals).toMatchObject({ sales: 1180, cost: 600, profit: 580, margin: 49.15, documents: 1 });
    expect(r.byCustomer[0]).toMatchObject({ customer: 'Cliente', profit: 580 });
  });

  it('rechaza rango inválido', async () => {
    const prisma = { invoice: { findMany: jest.fn() }, accountingEntry: { findMany: jest.fn() } };
    await expect(new SalesReportService(prisma as never).execute('c1', '2026-12-01', '2026-11-01')).rejects.toBeInstanceOf(BadRequestException);
  });
});
