import { describe, it, expect } from 'vitest';
import { productSchema } from '@/modules/inventory/validators/productSchema';

describe('productSchema', () => {
  it('valida exitosamente un producto conforme', () => {
    const valid = {
      sku: 'LAP-001',
      description: 'Laptop Gamer Core i7',
      sunat_type_code: '01',
      sunat_unit_code: 'NIU',
      min_stock_alert: 5,
    };
    const res = productSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('rechaza SKU muy corto', () => {
    const invalid = {
      sku: 'L',
      description: 'Laptop Gamer',
    };
    const res = productSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it('rechaza descripción muy corta', () => {
    const invalid = {
      sku: 'LAP-001',
      description: 'L',
    };
    const res = productSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it('rechaza stock mínimo negativo', () => {
    const invalid = {
      sku: 'LAP-001',
      description: 'Laptop Gamer',
      min_stock_alert: -2,
    };
    const res = productSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });
});

