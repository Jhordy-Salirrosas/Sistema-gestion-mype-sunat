import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenUseCase } from '../../../src/modules/auth/application/use-cases/refreshTokenUseCase';
import { RefreshTokenEntity } from '../../../src/modules/auth/domain/entities/refreshTokenEntity';
import { UserEntity } from '../../../src/modules/auth/domain/entities/userEntity';
import type { UserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import type { TokenServicePort } from '../../../src/modules/auth/domain/ports/tokenServicePort';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockTokenService: jest.Mocked<TokenServicePort>;

  const activeUser = new UserEntity({
    id: 'usr-1',
    companyId: 'comp-1',
    email: 'operador@mype.pe',
    fullName: 'Operador User',
    role: 'OPERADOR_FACTURACION',
    isActive: true,
  });

  const validTokenEntity = new RefreshTokenEntity({
    id: 'tok-1',
    userId: 'usr-1',
    tokenHash: 'hash_old_token',
    expiresAt: new Date(Date.now() + 3600 * 1000),
    isRevoked: false,
  });

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn().mockResolvedValue(activeUser),
      findByRuc: jest.fn(),
      findCompanyById: jest.fn(),
      createUserWithCompany: jest.fn(),
      saveRefreshToken: jest.fn(),
      findRefreshToken: jest.fn().mockResolvedValue(validTokenEntity),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
      updatePassword: jest.fn(),
      updateProfile: jest.fn(),
    };

    mockTokenService = {
      signToken: jest.fn().mockReturnValue('mocked.new.access.token'),
      verifyToken: jest.fn(),
      generateRefreshToken: jest.fn().mockReturnValue('new_raw_refresh_token_456'),
      hashToken: jest.fn().mockImplementation((raw) => `hash_of_${raw}`),
    };

    useCase = new RefreshTokenUseCase(mockUserRepo, mockTokenService);
  });

  it('debería rotar el token de refresco y emitir nuevo access token correctamente', async () => {
    const result = await useCase.execute('old_token');

    expect(result.accessToken).toBe('mocked.new.access.token');
    expect(result.refreshToken).toBe('new_raw_refresh_token_456');
    expect(result.tokenType).toBe('Bearer');
    expect(mockUserRepo.revokeRefreshToken).toHaveBeenCalledWith('hash_of_old_token');
    expect(mockUserRepo.saveRefreshToken).toHaveBeenCalledWith(
      'usr-1',
      'hash_of_new_raw_refresh_token_456',
      expect.any(Date),
    );
  });

  it('debería lanzar UnauthorizedException si no se proporciona el token', async () => {
    await expect(useCase.execute('')).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute(undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('debería lanzar UnauthorizedException si el token no existe en base de datos', async () => {
    mockUserRepo.findRefreshToken.mockResolvedValue(null);

    await expect(useCase.execute('token_inexistente')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debería revocar todas las sesiones del usuario si se detecta reutilización de token revocado', async () => {
    const revokedToken = new RefreshTokenEntity({
      id: 'tok-rev',
      userId: 'usr-1',
      tokenHash: 'hash_of_reused_token',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      isRevoked: true,
    });
    mockUserRepo.findRefreshToken.mockResolvedValue(revokedToken);

    await expect(useCase.execute('reused_token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockUserRepo.revokeAllUserRefreshTokens).toHaveBeenCalledWith('usr-1');
  });

  it('debería lanzar UnauthorizedException si el token ha expirado', async () => {
    const expiredToken = new RefreshTokenEntity({
      id: 'tok-exp',
      userId: 'usr-1',
      tokenHash: 'hash_of_expired_token',
      expiresAt: new Date(Date.now() - 3600 * 1000), // En el pasado
      isRevoked: false,
    });
    mockUserRepo.findRefreshToken.mockResolvedValue(expiredToken);

    await expect(useCase.execute('expired_token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
