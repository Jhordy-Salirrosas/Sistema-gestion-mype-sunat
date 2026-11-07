import { SolCredentialCipher } from '../../../src/modules/auth/infrastructure/security/solCredentialCipher';

describe('SolCredentialCipher', () => {
  const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const secret = 'clave-sol-ficticia-para-pruebas';

  it('cifra y descifra una credencial con AES-GCM', () => {
    const cipher = new SolCredentialCipher(key);
    const encrypted = cipher.encrypt(secret);

    expect(encrypted).not.toContain(secret);
    expect(SolCredentialCipher.isEncrypted(encrypted)).toBe(true);
    expect(cipher.decrypt(encrypted)).toBe(secret);
  });

  it('genera un ciphertext distinto para cada cifrado', () => {
    const cipher = new SolCredentialCipher(key);
    expect(cipher.encrypt(secret)).not.toBe(cipher.encrypt(secret));
  });

  it('rechaza claves inválidas, texto plano y ciphertext alterado', () => {
    expect(() => new SolCredentialCipher('invalid')).toThrow(
      /clave Base64 válida de 32 bytes/,
    );

    const cipher = new SolCredentialCipher(key);
    const parts = cipher.encrypt(secret).split(':');
    parts[3] = `${parts[3][0] === 'A' ? 'B' : 'A'}${parts[3].slice(1)}`;

    expect(() => cipher.decrypt(secret)).toThrow(/formato cifrado válido/);
    expect(() => cipher.decrypt(parts.join(':'))).toThrow(
      /No se pudieron descifrar las credenciales SOL/,
    );
  });
});
