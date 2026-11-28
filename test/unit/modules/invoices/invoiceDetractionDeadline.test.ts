import { describe, expect, it } from 'vitest';
import { fechaLimiteDetraccion, superaPlazoDetraccion, detraccionFueraDePlazo } from '@/modules/invoices/lib/invoiceDetractionDeadline';

describe('plazo referencial de detracción, lunes a viernes sin feriados', () => {
  it.each([
    ['2026-11-13', '2026-12-07'],
    ['2026-01-31', '2026-02-06'],
    ['2026-07-01', '2026-08-07'],
    ['2024-02-29', '2024-03-07'],
    ['2026-12-31', '2027-01-07'], // Incluye el viernes 1 de enero: no descuenta feriados.
    ['2026-11-13T00:00:00.000Z', '2026-12-07'],
  ])('%s vence el %s', (emision, limite) => expect(fechaLimiteDetraccion(emision)).toBe(limite));
  it.each(['', 'inválida', '2026-02-30', '2026-13-01'])('no inventa un plazo para %s', emision => {
    expect(fechaLimiteDetraccion(emision)).toBeNull();
    expect(detraccionFueraDePlazo({ emision, pendiente: true, depositos: [], hoy: '2026-12-08' })).toBe(false);
  });
  it('incluye el día límite y compara fechas ISO como días calendario', () => {
    expect(superaPlazoDetraccion('2026-12-06', '2026-12-07')).toBe(false);
    expect(superaPlazoDetraccion('2026-12-07T23:59:59Z', '2026-12-07')).toBe(false);
    expect(superaPlazoDetraccion('2026-12-08T00:00:00Z', '2026-12-07')).toBe(true);
    expect(superaPlazoDetraccion('', '2026-12-07')).toBe(false);
    expect(superaPlazoDetraccion('2026-12-08', null)).toBe(false);
  });
  it('marca pendientes vencidos, parciales y cualquier movimiento tardío, sin marcar pagos oportunos', () => {
    const base = { emision: '2026-11-13', depositos: [], pendiente: true, hoy: '2026-12-07' };
    expect(detraccionFueraDePlazo(base)).toBe(false);
    expect(detraccionFueraDePlazo({ ...base, hoy: '2026-12-08' })).toBe(true);
    expect(detraccionFueraDePlazo({ ...base, hoy: '2026-12-08', depositos: ['2026-12-01'] })).toBe(true);
    expect(detraccionFueraDePlazo({ ...base, pendiente: false, hoy: '2026-12-08', depositos: ['2026-12-07'] })).toBe(false);
    expect(detraccionFueraDePlazo({ ...base, pendiente: false, depositos: ['2026-12-01', '2026-12-08'] })).toBe(true);
  });
});
