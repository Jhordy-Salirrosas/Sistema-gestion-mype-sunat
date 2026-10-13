import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../../../src/modules/auth/infrastructure/guards/authGuard';
import type { TokenServicePort } from '../../../src/modules/auth/application/ports/tokenServicePort';

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
    };
    guard = new AuthGuard(mockTokenService);
  });

  it('debería autorizar cuando el token Bearer es válido', () => {
    mockTokenService.verifyToken.mockReturnValue({
      sub: 'usr-1',
      email: 'a@mype.pe',
      companyId: 'comp-1',
      role: 'ADMIN',
    });

    const ctx = createMockContext('Bearer valid.jwt.token');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('debería rechazar si falta el encabezado Authorization', () => {
    const ctx = createMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('debería rechazar si el token es inválido', () => {
    mockTokenService.verifyToken.mockReturnValue(null);
    const ctx = createMockContext('Bearer invalid.token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
