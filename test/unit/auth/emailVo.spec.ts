import { EmailVo } from '../../../src/modules/auth/domain/value-objects/emailVo';

describe('EmailVo', () => {
  it('debería instanciar correctamente con un correo válido y normalizarlo a minúsculas', () => {
    const email = new EmailVo('  Contador.MYPE@Empresa.COM.PE  ');
    expect(email.getValue()).toBe('contador.mype@empresa.com.pe');
    expect(email.toString()).toBe('contador.mype@empresa.com.pe');
  });

  it('debería lanzar un error si el correo está vacío o no es una cadena', () => {
    expect(() => new EmailVo('')).toThrow('El correo electrónico no puede estar vacío.');
    expect(() => new EmailVo('   ')).toThrow('El formato del correo electrónico es inválido');
    // @ts-expect-error probando valor inválido
    expect(() => new EmailVo(null)).toThrow('El correo electrónico no puede estar vacío.');
  });

  it('debería lanzar un error si el formato del correo no es válido', () => {
    const invalidEmails = [
      'correo-invalido',
      'correo@',
      '@dominio.com',
      'correo@dominio',
      'correo@.com',
      'correo..doble@dominio.com',
    ];

    for (const invalid of invalidEmails) {
      expect(() => new EmailVo(invalid)).toThrow('El formato del correo electrónico es inválido');
    }
  });

  it('debería comparar igualdad con otro EmailVo correctamente', () => {
    const email1 = new EmailVo('admin@mype.pe');
    const email2 = new EmailVo('ADMIN@MYPE.PE');
    const email3 = new EmailVo('otro@mype.pe');

    expect(email1.equals(email2)).toBe(true);
    expect(email1.equals(email3)).toBe(false);
  });
});
