import { PasswordStrengthRule } from '../../../src/modules/auth/domain/rules/passwordStrengthRule';

describe('PasswordStrengthRule', () => {
  it('debería aceptar contraseñas seguras con todos los requisitos', () => {
    expect(() =>
      PasswordStrengthRule.validate('Peru2026!Seguro'),
    ).not.toThrow();
  });

  it('debería rechazar contraseñas con menos de 8 caracteres', () => {
    expect(() => PasswordStrengthRule.validate('Pe1!a')).toThrow(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });

  it('debería rechazar contraseñas sin mayúsculas', () => {
    expect(() => PasswordStrengthRule.validate('peru2026!seguro')).toThrow(
      'La contraseña debe contener al menos una letra mayúscula.',
    );
  });

  it('debería rechazar contraseñas sin minúsculas', () => {
    expect(() => PasswordStrengthRule.validate('PERU2026!SEGURO')).toThrow(
      'La contraseña debe contener al menos una letra minúscula.',
    );
  });

  it('debería rechazar contraseñas sin números', () => {
    expect(() => PasswordStrengthRule.validate('PeruSeguro!Clave')).toThrow(
      'La contraseña debe contener al menos un número.',
    );
  });

  it('debería rechazar contraseñas sin caracteres especiales', () => {
    expect(() => PasswordStrengthRule.validate('Peru2026Seguro')).toThrow(
      'La contraseña debe contener al menos un carácter especial.',
    );
  });
});
