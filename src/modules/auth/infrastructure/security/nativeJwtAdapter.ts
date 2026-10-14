import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  TokenPayload,
  TokenServicePort,
} from '../../application/ports/tokenServicePort';

@Injectable()
export class NativeJwtAdapter implements TokenServicePort {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret =
      this.configService.get<string>('JWT_SECRET') ||
      'secret-clave-segura-desarrollo-sistema-mype-2026';
  }

  signToken(payload: TokenPayload, expiresInSeconds = 28800): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload = { ...payload, exp };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = this.createSignature(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): TokenPayload | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSig = this.createSignature(`${encodedHeader}.${encodedPayload}`);

    if (
      signature.length !== expectedSig.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return null;
    }

    try {
      const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson);
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null;
      }
      return payload as TokenPayload;
    } catch {
      return null;
    }
  }

  private createSignature(content: string): string {
    return createHmac('sha256', this.secret).update(content).digest('base64url');
  }
}
