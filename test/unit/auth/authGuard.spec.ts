import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import type { TokenServicePort } from '../../../src/modules/auth/domain/ports/tokenServicePort';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let mockTokenService: jest.Mocked<TokenServicePort>;

  const createMockContext = (authHeader?: string) => {
    const request = {
      headers: {
        authorization: authHeader,
      },
      user: undefined,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockTokenService = {
      signToken: jest.fn(),
      verifyToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      hashToken: jest.fn(),
    };
    guard = new AuthGuard(mockTokenService, {resolve:jest.fn(async p=>p)} as never);
  });

  it('debería autorizar cuando el token Bearer es válido', async () => {
    mockTokenService.verifyToken.mockReturnValue({
      sub: 'usr-1',
      email: 'a@mype.pe',
      companyId: 'comp-1',
      role: 'ADMIN',
    });

    const ctx = createMockContext('Bearer valid.jwt.token');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('debería rechazar si falta el encabezado Authorization', async () => {
    const ctx = createMockContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debería rechazar si el token es inválido', async () => {
    mockTokenService.verifyToken.mockReturnValue(null);
    const ctx = createMockContext('Bearer invalid.token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
