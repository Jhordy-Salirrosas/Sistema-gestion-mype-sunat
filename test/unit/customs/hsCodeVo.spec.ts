import { HsCodeVO } from '../../../src/modules/customs/domain/value-objects/hsCodeVo';

describe('HsCodeVO', () => {
  const rawFormatted = '8471.30.00.00';
  const cleanExpected = '8471300000';

  it('debe parsear y limpiar una subpartida arancelaria válida con puntos', () => {
    const vo = new HsCodeVO(rawFormatted);
    expect(vo.getValue()).toBe(cleanExpected);
    expect(vo.getFormatted()).toBe('8471.30.00.00');
    expect(vo.getChapter()).toBe('84');
    expect(vo.getHeading()).toBe('8471');
    expect(vo.getSubheading()).toBe('847130');
  });

  it('debe aceptar subpartidas con guiones y espacios', () => {
    const vo = new HsCodeVO('8471-30 00-00');
    expect(vo.getValue()).toBe(cleanExpected);
  });

  it('debe lanzar error si está vacía', () => {
    expect(() => new HsCodeVO('')).toThrow(
      'La subpartida nacional no puede estar vacía.',
    );
  });

  it('debe lanzar error si no contiene exactamente 10 dígitos numéricos', () => {
    expect(() => new HsCodeVO('8471.30.00')).toThrow(
      /Debe contener exactamente 10 dígitos numéricos/,
    );
    expect(() => new HsCodeVO('8471.30.00.00.99')).toThrow(
      /Debe contener exactamente 10 dígitos numéricos/,
    );
    expect(() => new HsCodeVO('8471.30.00.0A')).toThrow(
      /Debe contener exactamente 10 dígitos numéricos/,
    );
  });
});
