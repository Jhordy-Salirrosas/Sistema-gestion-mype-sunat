import { BadRequestException, Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export type SecretField =
  'sol_pass_encrypted' | 'cert_pass_encrypted' | 'certificate_pkcs12';

/** Canonical base64, exactly 256 bits. An absent key leaves legacy reads usable. */
export function parseIssuerKey(value: string | undefined): Buffer | undefined {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return undefined;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 && key.toString('base64') === value
    ? key
    : undefined;
}

@Injectable()
export class IssuerConfigEncryption {
  private key(): Buffer {
    const key = parseIssuerKey(process.env.ISSUER_CONFIG_ENCRYPTION_KEY);
    if (!key) throw new BadRequestException('ISSUER_CONFIG_KEY_UNAVAILABLE');
    return key;
  }

  encrypt(value: string, companyId: string, field: SecretField): string {
    const key = this.key();
    const kid = createHash('sha256').update(key).digest('hex').slice(0, 16);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(JSON.stringify([1, kid, companyId, field])));
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return JSON.stringify({
      v: 1,
      kid,
      nonce: nonce.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    });
  }

  decrypt(envelope: string, companyId: string, field: SecretField): string {
    try {
      const key = this.key();
      const data = JSON.parse(envelope);
      const kid = createHash('sha256').update(key).digest('hex').slice(0, 16);
      if (
        data.v !== 1 ||
        data.kid !== kid ||
        typeof data.ciphertext !== 'string'
      )
        throw new Error();
      const nonce = Buffer.from(data.nonce, 'base64');
      const tag = Buffer.from(data.tag, 'base64');
      if (nonce.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAAD(Buffer.from(JSON.stringify([1, kid, companyId, field])));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(data.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new BadRequestException('ISSUER_CONFIG_DECRYPTION_FAILED');
    }
  }
}
