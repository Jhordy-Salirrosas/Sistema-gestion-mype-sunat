import { movimientosDeFactura } from '../../../src/modules/invoices/application/services/kardexBridge';
const linea = { itemCode: 'CEM', cantidad: 2, valorUnitario: 100, descripcion: 'Cemento', unidad: 'NIU', afectacion: '10' };
const doc = { tipoComprobante: '01', serie: 'F001', correlativo: 1, fechaEmision: '2026-11-10', almacen: 'ALM-02' };
it('7B descarga la cantidad total del SKU, sin omitir la segunda línea', () => {
 expect(movimientosDeFactura([linea, { ...linea, cantidad: 3 }], doc)).toEqual([expect.objectContaining({ sku: 'CEM', quantity: 5, warehouse_code: 'ALM-02' })]);
});
it('7B suma cantidades decimales sin residuos y mantiene SKU distintos', () => {
 const r = movimientosDeFactura([{ ...linea, cantidad: .1 }, { ...linea, cantidad: .2 }, { ...linea, itemCode: 'ARE' }], doc);
 expect(r.map(m => [m.sku, m.quantity])).toEqual([['CEM', .3], ['ARE', 2]]);
});
it('7C una ND económica no crea ninguna salida física', () => {
 expect(movimientosDeFactura([linea], { ...doc, tipoComprobante: '08' })).toEqual([]);
});
it('7F una entrega gratuita descarga físicamente sin modificar la línea fiscal/ICBPER', () => {
 const gratis = { ...linea, afectacion: '11', icbperLinea: .5, cantidadBolsas: 1 };
 const copy = structuredClone(gratis);
 expect(movimientosDeFactura([gratis], doc)).toEqual([expect.objectContaining({ direction: 'SALIDA', quantity: 2 })]);
 expect(gratis).toEqual(copy);
});
