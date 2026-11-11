import { describe, it, expect } from 'vitest';
import casos from '../../../fixtures/m1/redondeo-paridad.json';
import { calcularItem, itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { round2 } from '@/modules/invoices/lib/invoiceTaxes';
describe('paridad con adapter y PayableAmount del back, HALF_UP', () => {
 it.each(casos)('$item.cantidad x $item.precioUnitario; $item.afectacion; $item.descuento.codigo', caso => {
  const afectacion = caso.item.afectacion === '10' ? 'GRAVADA' : caso.item.afectacion === '20' ? 'EXONERADA' : caso.item.afectacion === '30' ? 'INAFECTA' : 'GRATUITA';
  const descuento = caso.item.descuento ? { ...caso.item.descuento, codigo: caso.item.descuento.codigo as '00' | '01' } : undefined;
  const r = calcularItem({ ...itemVacio('1'), ...caso.item, afectacion, descuento, icbper: caso.item.cantidadBolsas * 0.5 });
  expect(r.total).toBe(caso.total); expect(r.igv).toBe(caso.igv);
 });
 it('HALF_UP en empates positivos y negativos', () => { expect(round2(1.005)).toBe(1.01); expect(round2(-1.005)).toBe(-1.01); });
});
