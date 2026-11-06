import { CATALOGO_54_DETRACCION } from '../../../src/modules/invoices/sunatCatalogs';
import { validarPago } from '../../../src/modules/invoices/application/services/paymentTermsAndSpotValidator';

it('mantiene códigos y porcentajes del SPOT conforme a SUNAT', () => {
  expect(CATALOGO_54_DETRACCION['012']).toEqual({ descripcion: 'Intermediación laboral y tercerización', porcentaje: 0.12 });
  expect(CATALOGO_54_DETRACCION['019']).toEqual({ descripcion: 'Arrendamiento de bienes', porcentaje: 0.1 });
  expect(CATALOGO_54_DETRACCION['022'].porcentaje).toBe(0.12);
  expect(CATALOGO_54_DETRACCION['035']).toEqual({ descripcion: 'Bienes exonerados del IGV', porcentaje: 0.015 });
  expect(CATALOGO_54_DETRACCION['039']).toEqual({ descripcion: 'Minerales no metálicos', porcentaje: 0.1 });
  expect((CATALOGO_54_DETRACCION as Record<string, { porcentaje: number }>)['037'].porcentaje).toBe(0.12);
});

it('rechaza un vencimiento que no existe en el calendario', () => {
  expect(() => validarPago({ formaPago: 'Credito', montoTotal: 100, fechaEmision: '2026-02-01', cuotas: [{ numero: 'Cuota001', monto: 100, vencimiento: '2026-02-30' }] })).toThrow(/fecha/i);
});

it('rechaza una cuota con fracciones de céntimo aunque la suma redondeada coincida', () => {
  expect(() => validarPago({ formaPago: 'Credito', montoTotal: 1, fechaEmision: '2026-02-01', cuotas: [{ numero: 'Cuota001', monto: 1.001, vencimiento: '2026-03-01' }] })).toThrow(/céntimo/i);
});
