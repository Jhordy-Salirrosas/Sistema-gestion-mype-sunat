import { NativeCryptoHasherAdapter } from '../../../src/modules/auth/infrastructure/security/nativeCryptoHasherAdapter';

describe('NativeCryptoHasherAdapter', () => {
  let hasher: NativeCryptoHasherAdapter;

  beforeEach(() => {
    hasher = new NativeCryptoHasherAdapter();
  });

  it('debería generar un hash válido con salt y verificarlo exitosamente', async () => {
    const raw = 'PasswordSegura2026!';
    const hashed = await hasher.hash(raw);

    expect(hashed).toContain(':');
    const isMatch = await hasher.compare(raw, hashed);
    expect(isMatch).toBe(true);
  });

  it('debería retornar false cuando la contraseña no coincide', async () => {
    const raw = 'PasswordSegura2026!';
    const hashed = await hasher.hash(raw);

    const isMatch = await hasher.compare('OtraPassword!', hashed);
    expect(isMatch).toBe(false);
  });

  it('debería retornar false ante formatos de hash inválidos', async () => {
    const isMatch = await hasher.compare('Cualquiera', 'hash_invalido_sin_separador');
    expect(isMatch).toBe(false);
  });
});
