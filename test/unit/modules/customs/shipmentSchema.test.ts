import { describe, it, expect } from 'vitest';
import { shipmentSchema } from '@/modules/customs/validators/shipmentSchema';

describe('shipmentSchema — Validación Zod de Apertura de Expedientes Aduaneros', () => {
  const validShipment = {
    shipment_number: 'EXP-2026-00042',
    supplier_id: '123e4567-e89b-12d3-a456-426614174000',
    incoterm: 'FOB' as const,
    currency_code: 'USD',
    transport_mode: 'MARITIMO' as const,
    origin_country_code: 'CN',
    destination_customs: '118',
    customs_broker_id: '123e4567-e89b-12d3-a456-426614174001',
    etd_date: '2026-10-20',
    eta_date: '2026-11-15',
    order_reference: 'OC-2026-SHENZHEN-001',
  };

  it('debe validar exitosamente un expediente con formato oficial EXP-YYYY-NNNNN', () => {
    const result = shipmentSchema.safeParse(validShipment);
    expect(result.success).toBe(true);
  });

  it('debe rechazar un número de expediente con formato incorrecto', () => {
    const invalidPayload = {
      ...validShipment,
      shipment_number: 'EXP-26-42', // Formato inválido
    };
    const result = shipmentSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('El formato debe ser EXP-AAAA-NNNNN');
    }
  });

  it('debe validar que el Incoterm pertenezca estrictamente al estándar ICC 2020', () => {
    const validIncoterms = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;
    for (const term of validIncoterms) {
      const res = shipmentSchema.safeParse({ ...validShipment, incoterm: term });
      expect(res.success).toBe(true);
    }

    const invalidRes = shipmentSchema.safeParse({ ...validShipment, incoterm: 'INVALID' as unknown as never });
    expect(invalidRes.success).toBe(false);
  });

  it('debe exigir que el código de país de origen tenga exactamente 2 caracteres ISO (ej. CN, US)', () => {
    const invalidCountry = {
      ...validShipment,
      origin_country_code: 'CHINA',
    };
    const result = shipmentSchema.safeParse(invalidCountry);
    expect(result.success).toBe(false);
  });

  it('debe validar que la intendencia aduanera contenga exactamente 3 dígitos numéricos', () => {
    const validCallao = shipmentSchema.safeParse({ ...validShipment, destination_customs: '118' });
    const validChancay = shipmentSchema.safeParse({ ...validShipment, destination_customs: '370' });
    const validAerea = shipmentSchema.safeParse({ ...validShipment, destination_customs: '235' });

    expect(validCallao.success).toBe(true);
    expect(validChancay.success).toBe(true);
    expect(validAerea.success).toBe(true);

    const invalid = shipmentSchema.safeParse({ ...validShipment, destination_customs: '11' });
    expect(invalid.success).toBe(false);
  });

  it('debe admitir campos opcionales vacíos como agente de aduanas o referencias sin romper la validación', () => {
    const minimal = {
      ...validShipment,
      customs_broker_id: '',
      etd_date: '',
      eta_date: '',
      order_reference: '',
    };
    const result = shipmentSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});
