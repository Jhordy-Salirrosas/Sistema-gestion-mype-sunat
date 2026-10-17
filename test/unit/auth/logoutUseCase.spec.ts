import { LogoutUseCase } from '../../../src/modules/auth/application/use-cases/logoutUseCase';
import type { UserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import type { TokenServicePort } from '../../../src/modules/auth/domain/ports/tokenServicePort';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockTokenService: jest.Mocked<TokenServicePort>;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByRuc: jest.fn(),
      findCompanyById: jest.fn(),
      createUserWithCompany: jest.fn(),
      saveRefreshToken: jest.fn(),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllUserRefreshTokens: jest.fn(),
      updatePassword: jest.fn(),
      updateProfile: jest.fn(),
    };

    mockTokenService = {
      signToken: jest.fn(),
      verifyToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      hashToken: jest.fn().mockReturnValue('hashed_token_val'),
    };

    useCase = new LogoutUseCase(mockUserRepo, mockTokenService);
  });

  it('debería revocar el refresh token si se proporciona y confirmar éxito', async () => {
    const result = await useCase.execute('raw_refresh_token_123');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Sesión finalizada exitosamente.');
    expect(mockTokenService.hashToken).toHaveBeenCalledWith('raw_refresh_token_123');
    expect(mockUserRepo.revokeRefreshToken).toHaveBeenCalledWith('hashed_token_val');
  });

  it('debería responder con éxito aunque no se envíe token', async () => {
    const result = await useCase.execute(undefined);

    expect(result.success).toBe(true);
    expect(mockUserRepo.revokeRefreshToken).not.toHaveBeenCalled();
  });
});
