import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/modules/auth/infrastructure/guards/rolesGuard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (role?: string) => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('debería permitir acceso si no se especifican roles en el endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = createMockContext('OPERADOR');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('debería permitir acceso si el usuario cuenta con el rol requerido', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'CONTADOR']);
    const ctx = createMockContext('CONTADOR');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('debería denegar acceso si el usuario no tiene el rol requerido', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const ctx = createMockContext('OPERADOR');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
