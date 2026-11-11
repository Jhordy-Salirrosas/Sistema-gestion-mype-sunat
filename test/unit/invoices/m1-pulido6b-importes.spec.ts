import { importesPersistidos, aListado } from '../../../src/modules/invoices/application/services/invoiceQueryMapper';
it('proyecta el monto persistido, sin recalcular 009 ni retención', () => {
 const payload = { montoTotal: 1000, codigoDetraccion: '009', montoDetraccion: 73.02, montoRetencion: 12.34 };
 expect(importesPersistidos(payload)).toEqual({ monto_detraccion: 73.02, monto_retencion: 12.34 });
 const row = { id: 'inv', fecha_emision: new Date('2026-11-10'), estado: 'ACEPTADO', serie: 'F001', correlativo: 66, monto_total: 1000, payload_ubl: payload };
 expect(aListado(row as never)).toMatchObject({ monto_detraccion: 73.02, monto_retencion: 12.34, monto_total: 1000 });
});
it.each([null, [], 'dato', {}, { montoDetraccion: -1, montoRetencion: '3' }, { montoDetraccion: NaN, montoRetencion: Infinity }])('mantiene ausentes/inválidos como null: %j', payload => {
 expect(importesPersistidos(payload)).toEqual({ monto_detraccion: null, monto_retencion: null });
});
it('conserva cero persistido como cero', () => expect(importesPersistidos({ montoDetraccion: 0, montoRetencion: 0 })).toEqual({ monto_detraccion: 0, monto_retencion: 0 }));
