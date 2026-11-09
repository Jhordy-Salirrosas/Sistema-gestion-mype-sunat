import { ExportTaxPleUseCase } from '../../../src/modules/accounting/application/use-cases/exportTaxPleUseCase';

describe('ExportTaxPleUseCase', () => {
  it('genera el registro de ventas 14.1', async () => {
    const prisma = { invoice: { findMany: jest.fn().mockResolvedValue([{
      fecha_emision: new Date('2026-11-05'), tipo_comprobante: '01', serie: 'F001', correlativo: 57,
      customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente SAC',
      taxable_operations: 100, total_igv: 18, exempt_operations: 0, unaffected_operations: 0,
      monto_total: 118, currency_code: 'PEN',
    }]) } };
    const useCase = new ExportTaxPleUseCase(prisma as never);
    const r = await useCase.execute('c1', '20601234567', 2026, 11, '140100');
    expect(r.recordsCount).toBe(1);
    expect(r.content).toContain('F001|57|6|20100070970|Cliente SAC|0.00|100.00|0.00|18.00');
  });

  it('genera el registro de compras 8.1', async () => {
    const prisma = { nationalPurchase: { findMany: jest.fn().mockResolvedValue([{
      issue_date: new Date('2026-11-06'), document_type_code: '01', document_serial: 'F001', document_number: '1',
      supplier_doc_type: '6', supplier_doc_number: '20100070970', supplier_name: 'Proveedor SAC',
      net_amount: 100, igv_amount: 18, total_amount: 118, currency_code: 'PEN', status: 'REGISTRADA',
    }]) } };
    const useCase = new ExportTaxPleUseCase(prisma as never);
    const r = await useCase.execute('c1', '20601234567', 2026, 11, '080100');
    expect(r.recordsCount).toBe(1);
    expect(r.content).toContain('F001|1|6|20100070970|Proveedor SAC|100.00|18.00');
  });
});
