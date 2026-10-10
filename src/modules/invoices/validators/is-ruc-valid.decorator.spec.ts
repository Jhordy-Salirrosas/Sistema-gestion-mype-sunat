import { IsRucValidConstraint } from './is-ruc-valid.decorator';

describe('IsRucValidConstraint', () => {
  let validator: IsRucValidConstraint;

  beforeEach(() => {
    validator = new IsRucValidConstraint();
  });

  it('debería retornar false si el valor no es un string', () => {
    expect(validator.validate(12345678901, {} as any)).toBe(false);
    expect(validator.validate(null, {} as any)).toBe(false);
  });

  it('debería retornar false si el RUC no tiene exactamente 11 dígitos numéricos', () => {
    expect(validator.validate('1234567890', {} as any)).toBe(false);
    expect(validator.validate('123456789012', {} as any)).toBe(false);
    expect(validator.validate('A2345678901', {} as any)).toBe(false);
  });

  it('debería validar un RUC que cumple el algoritmo Módulo 11', () => {
    expect(validator.validate('20100070970', {} as any)).toBe(true);
    expect(validator.validate('20100053455', {} as any)).toBe(true);
  });

  it('debería rechazar un RUC con dígito verificador incorrecto', () => {
    expect(validator.validate('20100070971', {} as any)).toBe(false);
  });

  it('debería retornar false para un RUC con dígito verificador adulterado', () => {
    expect(validator.validate('20100070971', {} as any)).toBe(false);
  });
});