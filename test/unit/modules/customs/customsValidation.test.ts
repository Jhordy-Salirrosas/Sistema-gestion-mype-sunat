import { describe, it, expect } from 'vitest';
import {
  registerDuaSchema,
  registerDuaItemSchema,
} from '@/modules/customs/validators/duaSchema';

describe('duaSchema — Validaciones Zod y Cuadre de Negocio', () => {
  const validBasePayload = {
    dua_number: '118-2026-10-001234',
    customs_agency_code: '118 - MARÍTIMA DEL CALLAO',
    regime_code: '10',
    numeration_date: '2026-10-15',
    fob_value_usd: 10000,
    freight_value_usd: 1500,
    insurance_value_usd: 500,
    exchange_rate: 3.8,
    ad_valorem_rate: 6,
    perception_rate: 3.5,
    items: [
      {
        item_order: 1,
        item_code: 'LAP-GAMER-01',
        hs_code: '8471.30.00.00',
        commercial_description: 'Laptop Gamer 16GB',
        quantity: 10,
        unit_code: 'NIU',
        fob_unit_usd: 600,
      },
      {
        item_order: 2,
        item_code: 'MON-LED-27',
        hs_code: '8528520000',
        commercial_description: 'Monitor Curvo 144Hz',
        quantity: 20,
        unit_code: 'NIU',
        fob_unit_usd: 200,
      },
    ],
  };

  describe('Validación de Máscara Oficial DAM / DUA', () => {
    it('debe aceptar un correlativo oficial bajo formato Aduana-Año-Régimen-Correlativo', () => {
      const result = registerDuaSchema.safeParse(validBasePayload);
      expect(result.success).toBe(true);
    });

    it('debe rechazar formatos inválidos o truncados de número de DAM', () => {
      const invalidPayload = {
        ...validBasePayload,
        dua_number: '118-2026-10-123', // Solo 3 dígitos de correlativo
      };
      const result = registerDuaSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Formato inválido de DAM');
      }
    });
  });

  describe('Validación de Subpartida Nacional Arancelaria (10 dígitos)', () => {
    it('debe validar subpartidas arancelarias tanto numéricas como con puntos normativos', () => {
      const validPlain = registerDuaItemSchema.safeParse({
        item_order: 1,
        hs_code: '8471300000',
        commercial_description: 'Laptops',
        quantity: 1,
        unit_code: 'NIU',
        fob_unit_usd: 500,
      });
      expect(validPlain.success).toBe(true);

      const validDotted = registerDuaItemSchema.safeParse({
        item_order: 1,
        hs_code: '8471.30.00.00',
        commercial_description: 'Laptops',
        quantity: 1,
        unit_code: 'NIU',
        fob_unit_usd: 500,
      });
      expect(validDotted.success).toBe(true);
    });

    it('debe rechazar subpartidas con longitud distinta a 10 dígitos', () => {
      const invalid = registerDuaItemSchema.safeParse({
        item_order: 1,
        hs_code: '8471', // Incompleta
        commercial_description: 'Laptops',
        quantity: 1,
        unit_code: 'NIU',
        fob_unit_usd: 500,
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('Regla de Cuadre Estricto de FOB (.refine)', () => {
    it('debe validar exitosamente cuando la sumatoria de series coincide con el FOB global', () => {
      const result = registerDuaSchema.safeParse(validBasePayload);
      expect(result.success).toBe(true);
    });

    it('debe fallar y emitir error específico si existe descuadre entre el FOB global y las series', () => {
      const unbalancedPayload = {
        ...validBasePayload,
        fob_value_usd: 12000, // Declarado 12,000 pero los ítems suman 10,000
      };

      const result = registerDuaSchema.safeParse(unbalancedPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPath = result.error.issues[0].path;
        expect(errorPath).toContain('fob_value_usd');
        expect(result.error.issues[0].message).toContain(
          'La suma de FOB de los ítems no coincide con el Valor FOB global declarado'
        );
      }
    });
  });
});
