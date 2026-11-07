import { describe, it, expect } from 'vitest';
import {
  localExpenseSchema,
  isValidPeruvianRuc,
} from '@/modules/customs/validators/localExpenseSchema';

describe('localExpenseSchema — Validación Zod de Comprobantes Locales y Algoritmo Módulo 11', () => {
  describe('isValidPeruvianRuc — Verificación de Dígito de Control SUNAT', () => {
    it('debe aceptar RUCs peruanos válidos de personas jurídicas (20) y personas naturales (10)', () => {
      // 20100047218: RUC oficial de Banco de Crédito del Perú (BCP)
      expect(isValidPeruvianRuc('20100047218')).toBe(true);
      // 20600000013: RUC calculado matemáticamente con dígito de chequeo 3
      expect(isValidPeruvianRuc('20600000013')).toBe(true);
    });

    it('debe rechazar RUCs con dígito de verificación adulterado', () => {
      // 20100047219 tiene dígito alterado (debe ser 8)
      expect(isValidPeruvianRuc('20100047219')).toBe(false);
      expect(isValidPeruvianRuc('20600000019')).toBe(false);
    });

    it('debe rechazar RUCs con longitud distinta a 11 dígitos', () => {
      expect(isValidPeruvianRuc('2010004721')).toBe(false); // 10 dígitos
      expect(isValidPeruvianRuc('201000472188')).toBe(false); // 12 dígitos
      expect(isValidPeruvianRuc('')).toBe(false);
    });

    it('debe rechazar RUCs con prefijos no autorizados por SUNAT', () => {
      // Prefijos válidos: 10, 15, 16, 17, 20
      expect(isValidPeruvianRuc('30100047218')).toBe(false);
      expect(isValidPeruvianRuc('99100047218')).toBe(false);
    });
  });

  describe('localExpenseSchema — Registro de Facturas Locales de Desaduanaje (NIC 2)', () => {
    const validExpense = {
      shipment_id: '123e4567-e89b-12d3-a456-426614174000',
      supplier_ruc: '20100047218',
      supplier_name: 'SERVICIOS PORTUARIOS DEL CALLAO S.A.C.',
      expense_concept: 'ALMACENAJE Y MANIPULEO DE CONTENEDOR',
      invoice_serial_number: 'F001-00048291',
      issue_date: '2026-10-18',
      net_amount_pen: 1000.0,
      igv_amount_pen: 180.0,
      total_amount_pen: 1180.0,
      spot_detraction_rate: 12.0, // Detracción SPOT 12% para servicios
      is_capitalizable: true,
      proration_method: 'PESO_BRUTO' as const,
    };

    it('debe validar un comprobante local correctamente estructurado y con IGV aislado', () => {
      const result = localExpenseSchema.safeParse(validExpense);
      expect(result.success).toBe(true);
    });

    it('debe rechazar series de comprobantes electrónicos con formato incorrecto', () => {
      const invalidSerial = {
        ...validExpense,
        invoice_serial_number: 'FACTURA-1234',
      };
      const result = localExpenseSchema.safeParse(invalidSerial);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('El formato debe ser Serie-Correlativo');
      }
    });

    it('debe validar formatos válidos de factura electrónica (F001, E001, 0001)', () => {
      const f1 = localExpenseSchema.safeParse({ ...validExpense, invoice_serial_number: 'F001-12345' });
      const e1 = localExpenseSchema.safeParse({ ...validExpense, invoice_serial_number: 'E001-987' });
      const num1 = localExpenseSchema.safeParse({ ...validExpense, invoice_serial_number: '0001-456' });

      expect(f1.success).toBe(true);
      expect(e1.success).toBe(true);
      expect(num1.success).toBe(true);
    });

    it('debe rechazar y emitir error si el Total no coincide con la suma del Monto Neto e IGV', () => {
      const unbalancedAmounts = {
        ...validExpense,
        net_amount_pen: 1000.0,
        igv_amount_pen: 180.0,
        total_amount_pen: 1500.0, // Descuadrado (debe ser 1180)
      };
      const result = localExpenseSchema.safeParse(unbalancedAmounts);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('total_amount_pen');
        expect(result.error.issues[0].message).toContain('El Total del comprobante debe coincidir con la suma');
      }
    });

    it('debe validar los métodos de prorrateo reconocidos por NIC 2', () => {
      const methods = ['VALOR_FOB', 'PESO_BRUTO', 'UNIDADES', 'VALOR_CIF'] as const;
      for (const method of methods) {
        const res = localExpenseSchema.safeParse({ ...validExpense, proration_method: method });
        expect(res.success).toBe(true);
      }

      const invalidMethod = localExpenseSchema.safeParse({
        ...validExpense,
        proration_method: 'ALEATORIO' as unknown as never,
      });
      expect(invalidMethod.success).toBe(false);
    });
  });
});
