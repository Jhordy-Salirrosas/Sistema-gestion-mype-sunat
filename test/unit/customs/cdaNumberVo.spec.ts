import { CdaNumberVO } from '../../../src/modules/customs/domain/value-objects/cdaNumberVo';

describe('CdaNumberVO', () => {
  const validCda = '11826100104589';

  it('debe inicializarse correctamente con un CDA de 14 dígitos', () => {
    const vo = new CdaNumberVO(validCda);
    expect(vo.getValue()).toBe(validCda);
    expect(vo.getCustomsCode()).toBe('118');
    expect(vo.getYearTwoDigits()).toBe('26');
    expect(vo.getSettlementTypeCode()).toBe('1001');
    expect(vo.getCorrelative()).toBe('04589');
  });

  it('debe limpiar espacios en blanco en los extremos', () => {
    const vo = new CdaNumberVO('  11826100104589  ');
    expect(vo.getValue()).toBe('11826100104589');
  });

  it('debe lanzar error si el CDA está vacío', () => {
    expect(() => new CdaNumberVO('')).toThrow(
      'El Código de Documento Aduanero (CDA) no puede estar vacío.',
    );
  });

  it('debe lanzar error si no tiene 14 dígitos numéricos', () => {
    expect(() => new CdaNumberVO('1182610010458')).toThrow(
      /Debe contener exactamente 14 dígitos numéricos/,
    );
    expect(() => new CdaNumberVO('118261001045899')).toThrow(
      /Debe contener exactamente 14 dígitos numéricos/,
    );
    expect(() => new CdaNumberVO('1182610010458A')).toThrow(
      /Debe contener exactamente 14 dígitos numéricos/,
    );
  });
});
