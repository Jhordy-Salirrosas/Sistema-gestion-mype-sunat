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
    expect(lineasDelPayload('texto')).toEqual([]);
    expect(lineasDelPayload(42)).toEqual([]);
    expect(lineasDelPayload({})).toEqual([]);
  });

  it('conserva descuentos válidos y convierte los campos inválidos en null', () => {
    expect(lineasDelPayload({ lineas: [{
      codigo: 123, descripcion: {}, unidad: false, afectacion: 10,
      cantidad: NaN, valorUnitario: Infinity, precioUnitario: '59', icbperLinea: -Infinity,
      descuentos: [{ codigo: '01', monto: 5 }, { codigo: 1, monto: NaN }, null, 'inválido', []],
    }] })).toEqual([{
      codigo: null, descripcion: null, unidad: null, afectacion: null,
      cantidad: null, valor_unitario: null, precio_unitario: null, icbper: null,
      descuentos: [
        { codigo: '01', monto: 5 }, { codigo: null, monto: null },
        { codigo: null, monto: null }, { codigo: null, monto: null }, { codigo: null, monto: null },
      ],
    }]);
  });

  it('tolera líneas inválidas y descuentos ausentes o que no son arreglos', () => {
    const vacia = { codigo: null, descripcion: null, unidad: null, cantidad: null,
      valor_unitario: null, precio_unitario: null, afectacion: null, icbper: null, descuentos: [] };
    expect(lineasDelPayload({ lineas: [null, 'texto', [], { descuentos: {} }, {}] }))
      .toEqual([vacia, vacia, vacia, vacia, vacia]);
  });
});
