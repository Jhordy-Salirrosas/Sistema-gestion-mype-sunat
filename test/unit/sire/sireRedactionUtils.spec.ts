import {
  describeErrorSafely,
  REDACTED_VALUE,
  redactSensitiveText,
  redactSensitiveValue,
} from '../../../src/modules/sire/domain/rules/sireRedactionUtils';

describe('sireRedactionUtils', () => {
  it('replaces the known secrets in a text', () => {
    expect(
      redactSensitiveText('falló con fake-sol-password', [
        'fake-sol-password',
      ]),
    ).toBe(`falló con ${REDACTED_VALUE}`);
  });

  it('ignores empty secrets', () => {
    expect(redactSensitiveText('texto sin secretos', [''])).toBe(
      'texto sin secretos',
    );
  });

  it('redacts bearer tokens, secret fields and url credentials', () => {
    expect(
      redactSensitiveText('Authorization: Bearer abc.def'),
    ).not.toContain('abc.def');
    expect(redactSensitiveText('password=abc123')).toBe(
      `password=${REDACTED_VALUE}`,
    );
    expect(redactSensitiveText('client_secret: abc123')).toBe(
      `client_secret=${REDACTED_VALUE}`,
    );
    expect(redactSensitiveText('postgres://user:clave@host:5432/db')).toBe(
      `postgres://user:${REDACTED_VALUE}@host:5432/db`,
    );
  });

  it('replaces the values of the sensitive keys of an object', () => {
    expect(
      redactSensitiveValue({ client_secret: 'valor', nombre: 'visible' }),
    ).toEqual({ client_secret: REDACTED_VALUE, nombre: 'visible' });
  });

  it('redacts nested objects and arrays', () => {
    expect(
      redactSensitiveValue(
        { items: [{ access_token: 'x' }, 'fake-sol-password'] },
        ['fake-sol-password'],
      ),
    ).toEqual({
      items: [{ access_token: REDACTED_VALUE }, REDACTED_VALUE],
    });
  });

  it('keeps the values that are not objects', () => {
    expect(redactSensitiveValue(42)).toBe(42);
    expect(redactSensitiveValue(null)).toBeNull();
    expect(redactSensitiveValue(true)).toBe(true);
  });

  it('describes an error with its code and status without leaking secrets', () => {
    const error = Object.assign(
      new Error('falló con fake-sol-password'),
      { code: 'ECONNREFUSED', status: 503 },
    );

    const description = describeErrorSafely(error, ['fake-sol-password']);

    expect(description).toContain('Error');
    expect(description).toContain('code=ECONNREFUSED');
    expect(description).toContain('status=503');
    expect(description).not.toContain('fake-sol-password');
  });

  it('describes a value that is not an error', () => {
    expect(describeErrorSafely('texto')).toBe('Error desconocido');
  });

  it('truncates very long messages', () => {
    const error = new Error('x'.repeat(900));

    expect(describeErrorSafely(error, [], 100)).toHaveLength(
      'Error: '.length + 100,
    );
  });
});
