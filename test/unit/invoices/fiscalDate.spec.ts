import { fechaFiscalLima, resolverFechaEmision } from '../../../src/modules/invoices/fiscalDate';
import { traducirEmision } from '../../../src/modules/invoices/application/services/emitirComprobanteAdapter';
import { validarPago } from '../../../src/modules/invoices/application/services/paymentTermsAndSpotValidator';
import { periodoActual } from '../../../src/modules/invoices/application/services/invoiceMetricsService';
import { periodoDe } from '../../../src/modules/invoices/application/services/accountingBridge';
import { validarPlazoDespachoRa } from '../../../src/modules/invoices/application/services/summaryDispatchDeadline';

const formulario = { tipo_comprobante: '01', serie: 'F001', forma_pago: 'Credito', customer_identity_type: '6',
  customer_identity_number: '20100070970', customer_legal_name: 'Cliente',
  items: [{ codigo: 'P', descripcion: 'Producto', cantidad: 1, unidad: 'NIU', valorUnitario: 100, afectacion: '10' }],
  cuotas: [{ monto: 118, vencimiento: '2026-11-13' }] };
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
it.each([
  ['2026-11-12T23:59:00Z', '2026-11-12'], // 18:59 Lima
  ['2026-11-13T00:00:00Z', '2026-11-12'], // 19:00 Lima
  ['2026-11-13T04:59:00Z', '2026-11-12'], // 23:59 Lima
  ['2026-11-13T05:00:00Z', '2026-11-13'], // 00:00 Lima
])('reloj %s: fecha fiscal, payload y registro coinciden en %s', (instant, expected) => {
  jest.useFakeTimers().setSystemTime(new Date(instant));
  expect(fechaFiscalLima(new Date(instant))).toBe(expected);
  const { dto } = traducirEmision(formulario as never, { ruc: '20100070970', razonSocial: 'Empresa' }, 1);
  expect(dto.payload_ubl.fechaEmision).toBe(expected);
  expect(dto.fecha_emision).toBe(`${expected}T00:00:00.000Z`);
});
it('crédito nocturno admite la primera cuota del día siguiente real y rechaza el mismo día', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-13T01:28:00Z'));
  const { dto } = traducirEmision(formulario as never, { ruc: '20100070970', razonSocial: 'Empresa' }, 1);
  const pago = { formaPago: 'Credito', fechaEmision: dto.payload_ubl.fechaEmision as string, montoTotal: 118,
    cuotas: [{ numero: 'Cuota001', monto: 118, vencimiento: '2026-11-13' }] };
  expect(() => validarPago(pago)).not.toThrow();
  expect(() => validarPago({ ...pago, cuotas: [{ ...pago.cuotas[0], vencimiento: '2026-11-12' }] })).toThrow('3267');
});
it('conserva fechas explícitas y representa días históricos sin convertirlos a Lima', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-12-01T01:00:00Z'));
  expect(resolverFechaEmision('2026-11-07')).toBe('2026-11-07');
  expect(resolverFechaEmision('2026-11-07T00:00:00.000Z')).toBe('2026-11-07T00:00:00.000Z');
  expect(resolverFechaEmision(null)).toBe('2026-11-30');
  const { dto } = traducirEmision({ ...formulario, fecha_emision: '2026-11-07' } as never, { ruc: '20100070970', razonSocial: 'Empresa' }, 1);
  expect(dto.fecha_emision).toBe('2026-11-07T00:00:00.000Z');
  expect(dto.payload_ubl.fechaEmision).toBe('2026-11-07');
  expect(periodoActual()).toBe('2026-11');
  expect(periodoDe('')).toBe('2026-11');
  expect(periodoDe('2026-10-31')).toBe('2026-10');
});
it('RA diferido nocturno conserva el día histórico y vence a medianoche de Lima', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-13T04:59:00Z'));
  const db = { invoice: { findMany: jest.fn(async () => [{ id: 'i', fecha_emision: new Date('2026-11-05T00:00:00Z') }]) } };
  const row = { company_id: 'c', members: [{ id: 'i' }] };
  await expect(validarPlazoDespachoRa(db as never, row as never)).resolves.toBeUndefined();
  jest.setSystemTime(new Date('2026-11-13T05:00:00Z'));
  await expect(validarPlazoDespachoRa(db as never, row as never)).rejects.toThrow('2957');
});
