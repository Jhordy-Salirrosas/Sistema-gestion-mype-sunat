import { DuaNumberVO } from '../../../src/modules/customs/domain/value-objects/duaNumberVo';

describe('DuaNumberVO (Pruebas Unitarias)', () => {
  it('debe aceptar un formato de DUA válido (118-2026-10-012345)', () => {
    const vo = new DuaNumberVO('118-2026-10-012345');
    expect(vo.getValue()).toBe('118-2026-10-012345');
    expect(vo.getCustomsAgencyCode()).toBe('118');
    expect(vo.getYear()).toBe(2026);
    expect(vo.getRegimeCode()).toBe('10');
    expect(vo.getCorrelative()).toBe('012345');
  });

  it('debe rechazar números de DUA con formato incorrecto', () => {
    expect(() => new DuaNumberVO('118-2026-10-123')).toThrow('inválido');
    expect(() => new DuaNumberVO('DUA-123456')).toThrow('inválido');
    expect(() => new DuaNumberVO('')).toThrow('inválido');
  });
});
