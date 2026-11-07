import { describe, it, expect } from 'vitest';
import { goodsReceiptSchema } from '@/modules/customs/validators/goodsReceiptSchema';

describe('goodsReceiptSchema', () => {
  const validPayload = {
    receiptNumber: 'ACTA-2026-0001',
    declarationId: 'decl-uuid-1234',
    shipmentId: 'ship-uuid-5678',
    warehouseCode: 'ALM-01',
    receptionType: 'TOTAL' as const,
    responsibleName: 'Juan Pérez Inspector',
    responsibleDni: '44556677',
    containerNumber: 'MSKU1234567',
    sealNumber: 'SEAL-9988',
    observations: 'Sin novedades físicas en precinto',
    items: [
      {
        customsItemId: 'item-1',
        productCode: 'PROD-001',
        commercialDescription: 'Laptops Gamer i7',
        declaredQuantity: 50,
        receivedQuantity: 50,
        damagedQuantity: 0,
        unitCode: 'NIU',
        destinationType: 'MERCADERIA' as const,
      },
    ],
  };

  it('valida exitosamente un acta de recepción conforme', () => {
    const result = goodsReceiptSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rechaza si el número de acta está vacío o es muy corto', () => {
    const invalid = { ...validPayload, receiptNumber: 'AC' };
    const result = goodsReceiptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('al menos 3 caracteres');
    }
  });

  it('rechaza si no tiene declarationId', () => {
    const invalid = { ...validPayload, declarationId: '' };
    const result = goodsReceiptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Debe seleccionar una DAM');
    }
  });

  it('rechaza si el responsable tiene menos de 3 caracteres', () => {
    const invalid = { ...validPayload, responsibleName: 'Al' };
    const result = goodsReceiptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rechaza si no se incluye ningún ítem en el acta', () => {
    const invalid = { ...validPayload, items: [] };
    const result = goodsReceiptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('al menos un ítem');
    }
  });

  it('valida recepción con discrepancia y averías', () => {
    const discrepancyPayload = {
      ...validPayload,
      receptionType: 'PARCIAL' as const,
      items: [
        {
          productCode: 'PROD-002',
          commercialDescription: 'Monitores 27"',
          declaredQuantity: 100,
          receivedQuantity: 95,
          damagedQuantity: 5,
          discrepancyReason: 'Caja golpeada durante estiba marítima',
          unitCode: 'NIU',
          destinationType: 'MERCADERIA' as const,
        },
      ],
    };
    const result = goodsReceiptSchema.safeParse(discrepancyPayload);
    expect(result.success).toBe(true);
  });

  it('rechaza cantidades negativas en los ítems', () => {
    const invalidItems = {
      ...validPayload,
      items: [
        {
          productCode: 'PROD-001',
          commercialDescription: 'Item',
          declaredQuantity: -5,
          receivedQuantity: 10,
        },
      ],
    };
    const result = goodsReceiptSchema.safeParse(invalidItems);
    expect(result.success).toBe(false);
  });
});

