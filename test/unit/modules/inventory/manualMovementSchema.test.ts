import { describe, it, expect } from 'vitest';
import { manualMovementSchema } from '@/modules/inventory/validators/manualMovementSchema';

describe('manualMovementSchema', () => {
  it('valida exitosamente un movimiento de entrada por compra nacional', () => {
    const valid = {
      sku: 'MON-27',
      direction: 'ENTRADA' as const,
      operation_type_code: '02',
      quantity: 10,
      unit_cost: 450,
      document_type_code: '01',
      document_serial: 'F001',
      document_number: '12345',
    };
    const res = manualMovementSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('valida exitosamente un movimiento de salida por venta', () => {
    const valid = {
      sku: 'MON-27',
      direction: 'SALIDA' as const,
      operation_type_code: '01',
      quantity: 4,
    };
    const res = manualMovementSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('rechaza cantidad menor o igual a cero', () => {
    const invalid = {
      sku: 'MON-27',
      direction: 'ENTRADA' as const,
      operation_type_code: '02',
      quantity: 0,
    };
    const res = manualMovementSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it('rechaza dirección inválida', () => {
    const invalid = {
      sku: 'MON-27',
      direction: 'OTRO',
      operation_type_code: '02',
      quantity: 10,
    };
    const res = manualMovementSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });
});

