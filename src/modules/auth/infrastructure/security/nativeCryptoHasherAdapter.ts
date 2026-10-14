import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { HasherPort } from '../../application/ports/hasherPort';

@Injectable()
export class NativeCryptoHasherAdapter implements HasherPort {
  async hash(plainText: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(plainText, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
  }

  async compare(plainText: string, hashed: string): Promise<boolean> {
    const parts = hashed.split(':');
    if (parts.length !== 2) return false;

    const [salt, key] = parts;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKeyBuffer = scryptSync(plainText, salt, 64);

    if (keyBuffer.length !== derivedKeyBuffer.length) return false;
    return timingSafeEqual(keyBuffer, derivedKeyBuffer);
  }
}
