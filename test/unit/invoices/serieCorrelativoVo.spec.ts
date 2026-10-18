import { SerieCorrelativoVo } from '../../../src/modules/invoices/domain/value-objects/serieCorrelativoVo';

describe('SerieCorrelativoVo', () => {
  it('crea correctamente una serie y correlativo válidos', () => {
    const vo = new SerieCorrelativoVo('F001', 123);
    expect(vo.serie).toBe('F001');
    expect(vo.correlativo).toBe(123);
    expect(vo.formatted).toBe('F001-00000123');
  });

  it('rechaza una serie con formato inválido', () => {
    expect(() => new SerieCorrelativoVo('X001', 1)).toThrow('formato oficial SUNAT');
    expect(() => new SerieCorrelativoVo('F01', 1)).toThrow('formato oficial SUNAT');
  });

  it('rechaza correlativos no enteros o fuera de rango', () => {
    expect(() => new SerieCorrelativoVo('F001', 0)).toThrow('entre 1 y 99999999');
    expect(() => new SerieCorrelativoVo('F001', -5)).toThrow('entre 1 y 99999999');
    expect(() => new SerieCorrelativoVo('F001', 1.5)).toThrow('entre 1 y 99999999');
  });
});
