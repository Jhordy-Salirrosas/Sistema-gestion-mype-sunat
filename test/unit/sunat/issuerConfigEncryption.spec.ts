import { validate } from '../../../src/config/env.validation';
import {
  IssuerConfigEncryption,
  parseIssuerKey,
} from '../../../src/modules/sunat/issuerConfigEncryption';

describe('D1 authenticated issuer encryption', () => {
  const encryption = new IssuerConfigEncryption();
  const original = process.env.ISSUER_CONFIG_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.ISSUER_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
  });
  afterAll(() => {
    if (original === undefined) delete process.env.ISSUER_CONFIG_ENCRYPTION_KEY;
    else process.env.ISSUER_CONFIG_ENCRYPTION_KEY = original;
  });
  it('uses randomized versioned envelopes and round trips without plaintext', () => {
    const a = encryption.encrypt(
      'obviously-fake-secret',
      'a',
      'sol_pass_encrypted',
    );
    const b = encryption.encrypt(
      'obviously-fake-secret',
      'a',
      'sol_pass_encrypted',
    );
    expect(a).not.toEqual(b);
    expect(a).not.toContain('obviously-fake-secret');
    expect(JSON.parse(a)).toMatchObject({
      v: 1,
      kid: expect.any(String),
      nonce: expect.any(String),
      tag: expect.any(String),
    });
    expect(encryption.decrypt(a, 'a', 'sol_pass_encrypted')).toBe(
      'obviously-fake-secret',
    );
  });
  it.each(['', 'short', Buffer.alloc(31).toString('base64'), 'x'.repeat(44)])(
    'rejects invalid key %s',
    (key) => {
      process.env.ISSUER_CONFIG_ENCRYPTION_KEY = key;
      expect(parseIssuerKey(key)).toBeUndefined();
      expect(() =>
        encryption.encrypt('fake', 'a', 'sol_pass_encrypted'),
      ).toThrow('ISSUER_CONFIG_KEY_UNAVAILABLE');
    },
  );
  it('rejects absent key on new writes', () => {
    delete process.env.ISSUER_CONFIG_ENCRYPTION_KEY;
    expect(() => encryption.encrypt('fake', 'a', 'sol_pass_encrypted')).toThrow(
      'ISSUER_CONFIG_KEY_UNAVAILABLE',
    );
  });
  it.each(['kid', 'nonce', 'ciphertext', 'tag', 'v'])(
    'authenticates %s',
    (field) => {
      const data = JSON.parse(
        encryption.encrypt('fake-password', 'a', 'sol_pass_encrypted'),
      );
      data[field] = field === 'v' ? 2 : Buffer.alloc(16, 3).toString('base64');
      expect(() =>
        encryption.decrypt(JSON.stringify(data), 'a', 'sol_pass_encrypted'),
      ).toThrow('ISSUER_CONFIG_DECRYPTION_FAILED');
    },
  );
  it('binds company and field', () => {
    const data = encryption.encrypt('fake', 'a', 'sol_pass_encrypted');
    expect(() => encryption.decrypt(data, 'b', 'sol_pass_encrypted')).toThrow(
      'ISSUER_CONFIG_DECRYPTION_FAILED',
    );
    expect(() => encryption.decrypt(data, 'a', 'cert_pass_encrypted')).toThrow(
      'ISSUER_CONFIG_DECRYPTION_FAILED',
    );
  });
  it('identifies rotation and fails closed until data is explicitly reencrypted', () => {
    const old = encryption.encrypt('fake', 'a', 'sol_pass_encrypted');
    const plain = encryption.decrypt(old, 'a', 'sol_pass_encrypted');
    process.env.ISSUER_CONFIG_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString(
      'base64',
    );
    expect(() => encryption.decrypt(old, 'a', 'sol_pass_encrypted')).toThrow(
      'ISSUER_CONFIG_DECRYPTION_FAILED',
    );
    const rotated = encryption.encrypt(plain, 'a', 'sol_pass_encrypted');
    expect(JSON.parse(rotated).kid).not.toBe(JSON.parse(old).kid);
    expect(encryption.decrypt(rotated, 'a', 'sol_pass_encrypted')).toBe('fake');
  });
});

describe('D1 optional encryption environment validation', () => {
  const legacy = {
    DATABASE_URL: 'postgresql://fake:fake@127.0.0.1/ta13_test',
    API_KEY: 'obviously-fake',
    JWT_SECRET: 'obviously-fake-jwt',
    RUC_EMISOR: '20000000001',
    CERT_PASSWORD: 'obviously-fake-cert-password',
    CERT_BASE64: 'obviously-fake-base64',
  };
  it.each([undefined, '', 'invalid'])(
    'keeps legacy startup usable without a valid encryption key: %s',
    (key) => {
      expect(
        validate({ ...legacy, ISSUER_CONFIG_ENCRYPTION_KEY: key })
          .ISSUER_CONFIG_ENCRYPTION_AVAILABLE,
      ).toBe(false);
    },
  );
  it('recognizes a valid 32 byte key', () => {
    expect(
      validate({
        ...legacy,
        ISSUER_CONFIG_ENCRYPTION_KEY: Buffer.alloc(32, 13).toString('base64'),
      }).ISSUER_CONFIG_ENCRYPTION_AVAILABLE,
    ).toBe(true);
  });
});
