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
    expect(validator.validate('1234567890', {} as any)).toBe(false); // 10 dígitos
    expect(validator.validate('123456789012', {} as any)).toBe(false); // 12 dígitos
    expect(validator.validate('A2345678901', {} as any)).toBe(false); // Alfanumérico
  });

  it('debería retornar true para un RUC válido y real', () => {
    // RUC de SUNAT (Ejemplo real)
    expect(validator.validate('20100070970', {} as any)).toBe(true);
    // Otro RUC válido común
    expect(validator.validate('20556272551', {} as any)).toBe(true);
  });

  it('debería retornar false para un RUC con dígito verificador adulterado (Módulo 11 inválido)', () => {
    // RUC 20100070970 con el último dígito adulterado a 1
    expect(validator.validate('20100070971', {} as any)).toBe(false);
  });
});
