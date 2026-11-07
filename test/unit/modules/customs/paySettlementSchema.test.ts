import { describe, it, expect } from 'vitest';
import { paySettlementSchema } from '@/modules/customs/validators/paySettlementSchema';

describe('paySettlementSchema — Validación Zod de Pago Bancario Teledespacho SUNAT', () => {
  const validPayment = {
    bank_code: '002', // Banco de Crédito del Perú (BCP)
    bank_operation_number: 'OP-BCP-9832104',
    paid_at: '2026-10-18T10:30:00Z',
    voucher_storage_url: 'https://storage.syncsunat.pe/vouchers/v-9832104.pdf',
  };

  it('debe validar un pago bancario con código oficial de 3 dígitos y operación válida', () => {
    const result = paySettlementSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it('debe admitir pago sin URL de comprobante digital (voucher físico o presencial)', () => {
    const withoutUrl = {
      ...validPayment,
      voucher_storage_url: '',
    };
    const result = paySettlementSchema.safeParse(withoutUrl);
    expect(result.success).toBe(true);
  });

  it('debe rechazar códigos de entidad bancaria que no tengan exactamente 3 dígitos numéricos', () => {
    const invalidBank = {
      ...validPayment,
      bank_code: 'BCP', // Formato no numérico
    };
    const result = paySettlementSchema.safeParse(invalidBank);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Seleccione una entidad bancaria autorizada por SUNAT');
    }
  });

  it('debe rechazar números de operación bancaria con longitud inferior a 4 caracteres', () => {
    const shortOp = {
      ...validPayment,
      bank_operation_number: '12',
    };
    const result = paySettlementSchema.safeParse(shortOp);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('al menos 4 caracteres');
    }
  });

  it('debe validar URLs válidas de comprobantes y rechazar strings que no sean URLs', () => {
    const invalidUrl = {
      ...validPayment,
      voucher_storage_url: 'no-es-una-url-valida',
    };
    const result = paySettlementSchema.safeParse(invalidUrl);
    expect(result.success).toBe(false);
  });
});
