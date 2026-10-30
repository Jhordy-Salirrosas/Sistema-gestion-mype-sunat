import { DamNumberVO } from '../../../src/modules/customs/domain/value-objects/damNumberVo';

describe('DamNumberVO', () => {
  const validDam = '118-2026-10-012345';

  it('debe inicializarse correctamente con un formato formal de DAM', () => {
    const vo = new DamNumberVO(validDam);
    expect(vo.getValue()).toBe(validDam);
    expect(vo.getCustomsAgencyCode()).toBe('118');
    expect(vo.getYear()).toBe(2026);
    expect(vo.getRegimeCode()).toBe('10');
    expect(vo.getCorrelative()).toBe('012345');
  });

  it('debe limpiar espacios en blanco en los extremos', () => {
    const vo = new DamNumberVO('  118-2026-10-012345  ');
    expect(vo.getValue()).toBe('118-2026-10-012345');
  });

  it('debe rechazar formatos que no sigan Aduana-Año-Régimen-Correlativo', () => {
    expect(() => new DamNumberVO('118-26-10-12345')).toThrow(/Número de DUA\/DAM inválido/);
    expect(() => new DamNumberVO('118202610012345')).toThrow(/Número de DUA\/DAM inválido/);
    expect(() => new DamNumberVO('')).toThrow(/Número de DUA\/DAM inválido/);
  });
});

