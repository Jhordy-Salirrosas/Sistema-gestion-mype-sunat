import { aplicarDescuentoGlobal } from '../../../src/modules/invoices/application/services/descuentoGlobal';
const base = { gravado: 1000, igv: 180, exonerado: 0, inafecto: 0, exportado: 0, icbper: 0 };
describe('descuentos globales 02 y 03', () => {
  it('02 reduce base e IGV', () => {
    const r = aplicarDescuentoGlobal(base, { codigo: '02', monto: 100 });
    expect(r.bases).toMatchObject({ gravado: 900, igv: 162 });
    expect(r.total).toBe(1062);
  });
  it('03 reduce el total sin modificar base ni IGV', () => {
    const r = aplicarDescuentoGlobal(base, { codigo: '03', monto: 100 });
    expect(r.bases).toEqual(base);
    expect(r.total).toBe(1080);
    expect(r.otrosDescuentos).toBe(100);
  });
  it('rechaza un descuento excesivo y el código 04', () => {
    expect(() => aplicarDescuentoGlobal(base, { codigo: '02', monto: 1001 })).toThrow();
    expect(() => aplicarDescuentoGlobal(base, { codigo: '04' as '02', monto: 100 })).toThrow();
  });
});
