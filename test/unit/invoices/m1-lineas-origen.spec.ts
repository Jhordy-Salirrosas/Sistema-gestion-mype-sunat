import { lineasDelPayload } from '../../../src/modules/invoices/application/services/invoiceQueryMapper';

describe('líneas reales del detalle del comprobante', () => {
  it('expone las líneas guardadas sin inventar campos ausentes', () => {
    expect(lineasDelPayload({ lineas: [{ codigo: 'MAT-1', descripcion: 'Cemento', unidad: 'NIU', cantidad: 2, valorUnitario: 50, precioUnitario: 59, afectacion: '10' }] })).toEqual([
      { codigo: 'MAT-1', descripcion: 'Cemento', unidad: 'NIU', cantidad: 2, valor_unitario: 50, precio_unitario: 59, afectacion: '10', icbper: null, descuentos: [] },
    ]);
    expect(lineasDelPayload({ linea: { descripcion: 'Servicio', cantidad: 1, valorUnitario: 10 } })).toEqual([
      { codigo: null, descripcion: 'Servicio', unidad: null, cantidad: 1, valor_unitario: 10, precio_unitario: null, afectacion: null, icbper: null, descuentos: [] },
    ]);
  });
  it('devuelve una lista vacía cuando no existen líneas', () => {
    expect(lineasDelPayload(null)).toEqual([]);
    expect(lineasDelPayload({})).toEqual([]);
  });
});
