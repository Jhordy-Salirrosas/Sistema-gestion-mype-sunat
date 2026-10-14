import { ConfigService } from '@nestjs/config';
import { NativeJwtAdapter } from '../../../src/modules/auth/infrastructure/security/nativeJwtAdapter';

describe('NativeJwtAdapter', () => {
  let adapter: NativeJwtAdapter;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue('super-secret-key-1234567890'),
    } as unknown as ConfigService;
    adapter = new NativeJwtAdapter(configService);
  });

  it('debería emitir un token y verificarlo extrayendo el payload', () => {
    const payload = {
      sub: 'usr-1',
      email: 'test@mype.pe',
      companyId: 'comp-1',
      role: 'ADMIN',
    };

    const token = adapter.signToken(payload, 3600);
    expect(token).toBeDefined();

    const verified = adapter.verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('usr-1');
    expect(verified?.role).toBe('ADMIN');
  });

  it('debería retornar null ante un token adulterado', () => {
    const payload = {
      sub: 'usr-1',
      email: 'test@mype.pe',
      companyId: 'comp-1',
      role: 'ADMIN',
    };

    const token = adapter.signToken(payload, 3600);
    const tampered = token.slice(0, -4) + 'abcd';
    expect(adapter.verifyToken(tampered)).toBeNull();
  });

  it('debería retornar null ante un token expirado', () => {
    const payload = {
      sub: 'usr-1',
      email: 'test@mype.pe',
      companyId: 'comp-1',
      role: 'ADMIN',
    };

    const expiredToken = adapter.signToken(payload, -10);
    expect(adapter.verifyToken(expiredToken)).toBeNull();
  });
});
