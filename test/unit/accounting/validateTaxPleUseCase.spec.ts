import { BadRequestException } from '@nestjs/common';
import { ValidateTaxPleUseCase } from '../../../src/modules/accounting/application/use-cases/validateTaxPleUseCase';

describe('ValidateTaxPleUseCase', () => {
  it('valida ventas correctas', async () => {
    const prisma = { invoice: { findMany: jest.fn().mockResolvedValue([{ serie: 'F001', correlativo: 1, customer_identity_type: '6', customer_identity_number: '20100070970', customer_legal_name: 'Cliente', taxable_operations: 100, total_igv: 18, exempt_operations: 0, unaffected_operations: 0, monto_total: 118 }]) } };
    const r = await new ValidateTaxPleUseCase(prisma as never).execute('c1', '20100070970', 2026, 11, '140100');
    expect(r.valid).toBe(true);
    expect(r.records).toBe(1);
  });

  it('detecta documento y total inválidos', async () => {
    const prisma = { invoice: { findMany: jest.fn().mockResolvedValue([{ serie: 'F001', correlativo: 1, customer_identity_type: '6', customer_identity_number: '123', customer_legal_name: '', taxable_operations: 100, total_igv: 10, exempt_operations: 0, unaffected_operations: 0, monto_total: 999 }]) } };
    const r = await new ValidateTaxPleUseCase(prisma as never).execute('c1', '20100070970', 2026, 11, '140100');
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === 'documento_identidad')).toBe(true);
    expect(r.issues.some((i) => i.field === 'monto_total')).toBe(true);
  });

  it('valida compras y rechaza período inválido', async () => {
    const prisma = { nationalPurchase: { findMany: jest.fn().mockResolvedValue([{ document_serial: 'F001', document_number: '1', supplier_doc_type: '6', supplier_doc_number: '20100070970', supplier_name: 'Proveedor', net_amount: 100, igv_amount: 18, total_amount: 118 }]) } };
    const uc = new ValidateTaxPleUseCase(prisma as never);
    await expect(uc.execute('c1', '20100070970', 2026, 11, '080100')).resolves.toMatchObject({ valid: true, records: 1 });
    await expect(uc.execute('c1', '20100070970', 2026, 13, '080100')).rejects.toBeInstanceOf(BadRequestException);
  });
});
