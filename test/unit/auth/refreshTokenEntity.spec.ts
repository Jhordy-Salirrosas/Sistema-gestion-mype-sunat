import { RefreshTokenEntity } from '../../../src/modules/auth/domain/entities/refreshTokenEntity';

describe('RefreshTokenEntity', () => {
  const oneHour = 3600 * 1000;

  it('debería instanciar correctamente con sus propiedades', () => {
    const futureDate = new Date(Date.now() + oneHour);
    const token = new RefreshTokenEntity({
      id: 'tok-123',
      userId: 'usr-456',
      tokenHash: 'hash-abc-789',
      expiresAt: futureDate,
      isRevoked: false,
    });

    expect(token.id).toBe('tok-123');
    expect(token.userId).toBe('usr-456');
    expect(token.tokenHash).toBe('hash-abc-789');
    expect(token.expiresAt).toBe(futureDate);
    expect(token.isRevoked).toBe(false);
  });

  it('debería calcular correctamente si está expirado o válido', () => {
    const pastDate = new Date(Date.now() - oneHour);
    const futureDate = new Date(Date.now() + oneHour);

    const expiredToken = new RefreshTokenEntity({
      id: 'tok-exp',
      userId: 'usr-1',
      tokenHash: 'hash-exp',
      expiresAt: pastDate,
      isRevoked: false,
    });

    const activeToken = new RefreshTokenEntity({
      id: 'tok-act',
      userId: 'usr-2',
      tokenHash: 'hash-act',
      expiresAt: futureDate,
      isRevoked: false,
    });

    const revokedToken = new RefreshTokenEntity({
      id: 'tok-rev',
      userId: 'usr-3',
      tokenHash: 'hash-rev',
      expiresAt: futureDate,
      isRevoked: true,
    });

    expect(expiredToken.isExpired()).toBe(true);
    expect(expiredToken.isValid()).toBe(false);

    expect(activeToken.isExpired()).toBe(false);
    expect(activeToken.isValid()).toBe(true);

    expect(revokedToken.isExpired()).toBe(false);
    expect(revokedToken.isValid()).toBe(false);
  });

  it('debería retornar una nueva instancia con isRevoked=true al revocar', () => {
    const futureDate = new Date(Date.now() + oneHour);
    const token = new RefreshTokenEntity({
      id: 'tok-1',
      userId: 'usr-1',
      tokenHash: 'hash-1',
      expiresAt: futureDate,
      isRevoked: false,
    });

    const revoked = token.revoke();

    expect(token.isRevoked).toBe(false);
    expect(revoked.isRevoked).toBe(true);
    expect(revoked.isValid()).toBe(false);
    expect(revoked.id).toBe(token.id);
  });
});
