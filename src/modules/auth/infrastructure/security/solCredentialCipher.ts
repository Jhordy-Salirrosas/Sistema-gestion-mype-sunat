import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { SolCredentialCipherPort } from '../../domain/ports/solCredentialCipherPort';

const CIPHERTEXT_PREFIX = 'sol:v1:';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class SolCredentialCipher implements SolCredentialCipherPort {
  private readonly key: Buffer;

  constructor(encodedKey: string) {
    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== KEY_LENGTH || key.toString('base64') !== encodedKey) {
      throw new Error(
        'SOL_CREDENTIALS_ENCRYPTION_KEY debe ser una clave Base64 válida de 32 bytes.',
      );
    }
    this.key = key;
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      CIPHERTEXT_PREFIX.slice(0, -1),
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(cipherText: string): string {
    if (!cipherText.startsWith(CIPHERTEXT_PREFIX)) {
      throw new Error(
        'Las credenciales SOL no tienen un formato cifrado válido.',
      );
    }
    const [ivText, authTagText, encryptedText, ...extra] = cipherText
      .slice(CIPHERTEXT_PREFIX.length)
      .split(':');
    if (
      !ivText ||
      !authTagText ||
      encryptedText === undefined ||
      extra.length > 0
    ) {
      throw new Error(
        'Las credenciales SOL no tienen un formato cifrado válido.',
      );
    }

    const iv = Buffer.from(ivText, 'base64');
    const authTag = Buffer.from(authTagText, 'base64');
    const encrypted = Buffer.from(encryptedText, 'base64');
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        'Las credenciales SOL no tienen un formato cifrado válido.',
      );
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error('No se pudieron descifrar las credenciales SOL.');
    }
  }

  static isEncrypted(cipherText: string): boolean {
    return cipherText.startsWith(CIPHERTEXT_PREFIX);
  }
}
