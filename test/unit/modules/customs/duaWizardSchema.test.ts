import { describe, it, expect } from 'vitest';
import {
  duaWizardSchema,
  duaWizardItemSchema,
} from '@/modules/customs/validators/duaWizardSchema';

describe('duaWizardSchema — Validación Zod del Asistente DAM / DUA SUNAT', () => {
  const validItem1 = {
    series_order: 1,
    product_code: 'LAP-GAMER-16',
    hs_code: '8471300000',
    commercial_description: 'Laptop Gamer 16GB RAM Intel Core i7 pantalla 15.6 pulgadas',
    goods_state: 'NUEVO' as const,
    tpi_code: '',
    physical_quantity: 60,
    physical_unit: 'NIU',
    net_weight_kg: 120.5,
    gross_weight_kg: 145.0,
    fob_usd: 30000.0,
    ad_valorem_rate: 0,
  };

  const validItem2 = {
    series_order: 2,
    product_code: 'MON-4K-27',
    hs_code: '8528520000',
    commercial_description: 'Monitor 4K UHD 27 pulgadas IPS 144Hz',
    goods_state: 'NUEVO' as const,
    tpi_code: '',
    physical_quantity: 40,
    physical_unit: 'NIU',
    net_weight_kg: 160.0,
    gross_weight_kg: 180.0,
    fob_usd: 20000.0,
    ad_valorem_rate: 6,
  };

  const validWizardPayload = {
    shipment_id: '123e4567-e89b-12d3-a456-426614174000',
    customs_code: '118',
    declaration_year: 2026,
    correlative_number: '004200',
    numeration_date: '2026-10-18',
    dispatch_mode: '10' as const, // Despacho Anticipado
    channel: 'VERDE' as const,
    transport_doc_number: 'COSU-654987321',
    manifest_number: '2026-MAN-0012',
    fob_total_usd: 50000.0,
    freight_total_usd: 1200.0,
    insurance_total_usd: 375.0,
    exchange_rate: 3.82,
    has_article_160_guarantee: false,
    items: [validItem1, validItem2],
  };

  describe('duaWizardItemSchema — Series Arancelarias y Restricciones Físicas', () => {
    it('debe validar una serie arancelaria con SPN de 10 dígitos y pesos coherentes', () => {
      const result = duaWizardItemSchema.safeParse(validItem1);
      expect(result.success).toBe(true);
    });

    it('debe rechazar una Subpartida Nacional con longitud distinta a 10 dígitos', () => {
      const invalidHs = {
        ...validItem1,
        hs_code: '847130', // Solo 6 dígitos
      };
      const result = duaWizardItemSchema.safeParse(invalidHs);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('10 dígitos numéricos exactos');
      }
    });

    it('debe rechazar cuando el peso bruto es estrictamente menor al peso neto (violación física)', () => {
      const invalidWeights = {
        ...validItem1,
        net_weight_kg: 150.0,
        gross_weight_kg: 120.0, // Bruto menor que neto
      };
      const result = duaWizardItemSchema.safeParse(invalidWeights);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('El peso bruto debe ser mayor o igual al peso neto');
      }
    });

    it('debe rechazar descripciones comerciales genéricas con menos de 5 caracteres', () => {
      const invalidDesc = {
        ...validItem1,
        commercial_description: 'PC',
      };
      const result = duaWizardItemSchema.safeParse(invalidDesc);
      expect(result.success).toBe(false);
    });
  });

  describe('duaWizardSchema — Integridad de la DAM y Regla de Balance FOB', () => {
    it('debe validar exitosamente cuando la sumatoria FOB de los ítems coincide con el FOB total declarado', () => {
      const result = duaWizardSchema.safeParse(validWizardPayload);
      expect(result.success).toBe(true);
    });

    it('debe admitir una discrepancia mínima por redondeo dentro de la tolerancia de $0.05', () => {
      const slightlyToleratedPayload = {
        ...validWizardPayload,
        fob_total_usd: 50000.03, // 3 centavos de diferencia
      };
      const result = duaWizardSchema.safeParse(slightlyToleratedPayload);
      expect(result.success).toBe(true);
    });

    it('debe rechazar y emitir error específico si el FOB total no coincide con la suma de series (> $0.05)', () => {
      const unbalancedPayload = {
        ...validWizardPayload,
        fob_total_usd: 50500.0, // Diferencia de $500
      };
      const result = duaWizardSchema.safeParse(unbalancedPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('fob_total_usd');
        expect(result.error.issues[0].message).toContain('La sumatoria del valor FOB de las series no coincide');
      }
    });

    it('debe rechazar declaraciones sin al menos una serie arancelaria', () => {
      const emptyItemsPayload = {
        ...validWizardPayload,
        items: [],
      };
      const result = duaWizardSchema.safeParse(emptyItemsPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('debe tener al menos una serie');
      }
    });

    it('debe validar modalidades de despacho SUNAT autorizadas (10 Anticipado, 00 Diferido, 01 Urgente)', () => {
      const modes = ['10', '00', '01', '02'] as const;
      for (const mode of modes) {
        const res = duaWizardSchema.safeParse({ ...validWizardPayload, dispatch_mode: mode });
        expect(res.success).toBe(true);
      }

      // El cast es deliberado: se inyecta un valor fuera del esquema para probar la validación.
      const invalidMode = duaWizardSchema.safeParse({ ...validWizardPayload, dispatch_mode: '99' as unknown as never });
      expect(invalidMode.success).toBe(false);
    });
  });
});
