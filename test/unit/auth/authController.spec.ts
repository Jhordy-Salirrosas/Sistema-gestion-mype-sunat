import type { Request, Response } from 'express';
import { ForbiddenException } from '@nestjs/common';
import { AuthController } from '../../../src/modules/auth/infrastructure/controllers/authController';
import type { RegisterUseCase } from '../../../src/modules/auth/application/use-cases/registerUseCase';
import type { LoginUseCase } from '../../../src/modules/auth/application/use-cases/loginUseCase';
import type { LogoutUseCase } from '../../../src/modules/auth/application/use-cases/logoutUseCase';
import type { RefreshTokenUseCase } from '../../../src/modules/auth/application/use-cases/refreshTokenUseCase';
import type { GetProfileUseCase } from '../../../src/modules/auth/application/use-cases/getProfileUseCase';
import type { UpdateProfileUseCase } from '../../../src/modules/auth/application/use-cases/updateProfileUseCase';
import type { ChangePasswordUseCase } from '../../../src/modules/auth/application/use-cases/changePasswordUseCase';
import type { TokenPayload } from '../../../src/modules/auth/domain/ports/tokenServicePort';

describe('AuthController', () => {
  let controller: AuthController;
  let mockRegisterUseCase: jest.Mocked<RegisterUseCase>;
  let mockLoginUseCase: jest.Mocked<LoginUseCase>;
  let mockLogoutUseCase: jest.Mocked<LogoutUseCase>;
  let mockRefreshTokenUseCase: jest.Mocked<RefreshTokenUseCase>;
  let mockGetProfileUseCase: jest.Mocked<GetProfileUseCase>;
  let mockUpdateProfileUseCase: jest.Mocked<UpdateProfileUseCase>;
  let mockWarehouseAccess: any;
  let mockChangePasswordUseCase: jest.Mocked<ChangePasswordUseCase>;

  const mockUserPayload: TokenPayload = {
    sub: 'usr-123',
    email: 'admin@mype.pe',
    companyId: 'comp-456',
    role: 'ADMIN',
  };

  const createMockResponse = (): Response => {
    const res: Partial<Response> = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(() => {
    mockRegisterUseCase = { execute: jest.fn() } as unknown as jest.Mocked<RegisterUseCase>;
    mockLoginUseCase = { execute: jest.fn() } as unknown as jest.Mocked<LoginUseCase>;
    mockLogoutUseCase = { execute: jest.fn() } as unknown as jest.Mocked<LogoutUseCase>;
    mockRefreshTokenUseCase = { execute: jest.fn() } as unknown as jest.Mocked<RefreshTokenUseCase>;
    mockGetProfileUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetProfileUseCase>;
    mockUpdateProfileUseCase = { execute: jest.fn() } as unknown as jest.Mocked<UpdateProfileUseCase>;
    mockChangePasswordUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ChangePasswordUseCase>;
    mockWarehouseAccess = { listAllowed: jest.fn(), listUsers: jest.fn(), setUserWarehouses: jest.fn() } as any;

    controller = new AuthController(
      mockRegisterUseCase,
      mockLoginUseCase,
      mockLogoutUseCase,
      mockRefreshTokenUseCase,
      mockGetProfileUseCase,
      mockUpdateProfileUseCase,
      mockChangePasswordUseCase,
      mockWarehouseAccess,
    );
  });

  it('debería registrar una MYPE y setear cookie con refreshToken', async () => {
    const mockAuthResponse = {
      accessToken: 'access.jwt.token',
      tokenType: 'Bearer',
      expiresInSeconds: 900,
      refreshToken: 'raw_refresh_token_123',
      user: {
        id: 'usr-123',
        email: 'admin@mype.pe',
        fullName: 'Admin Demo',
        role: 'ADMIN',
        companyId: 'comp-456',
      },
    };
    mockRegisterUseCase.execute.mockResolvedValue(mockAuthResponse);
    const mockReq = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
    } as unknown as Request;
    const mockRes = createMockResponse();

    const result = await controller.register(
      {
        ruc: '20100070970',
        legalName: 'DEMO S.A.C.',
        solUser: 'MODDATOS',
        solPassword: 'PasswordSol123!',
        fullName: 'Admin Demo',
        email: 'admin@mype.pe',
        password: 'Password123!#',
      },
      mockReq,
      mockRes,
    );

    expect(result).toBe(mockAuthResponse);
    expect(mockRegisterUseCase.execute).toHaveBeenCalledWith(
      expect.any(Object),
      { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    );
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'raw_refresh_token_123',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('usa valores de auditoría seguros cuando la solicitud no informa IP ni agente', async () => {
    mockRegisterUseCase.execute.mockResolvedValue({
      accessToken: 'access.jwt.token',
      tokenType: 'Bearer',
      expiresInSeconds: 900,
      refreshToken: null,
      user: {
        id: 'usr-123',
        email: 'admin@mype.pe',
        fullName: 'Admin Demo',
        role: 'ADMIN',
        companyId: 'comp-456',
      },
    });
    const req = {
      ip: undefined,
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as Request;

    await controller.register(
      {
        ruc: '20100070970',
        legalName: 'DEMO S.A.C.',
        solUser: 'MODDATOS',
        solPassword: 'fake-sol-password',
        fullName: 'Admin Demo',
        email: 'admin@mype.pe',
        password: 'Password123!#',
      },
      req,
      createMockResponse(),
    );

    expect(mockRegisterUseCase.execute).toHaveBeenCalledWith(
      expect.any(Object),
      { ipAddress: 'desconocida', userAgent: null },
    );
  });

  it('debería iniciar sesión y setear cookie con refreshToken', async () => {
    const mockAuthResponse = {
      accessToken: 'access.jwt.token',
      tokenType: 'Bearer',
      expiresInSeconds: 900,
      refreshToken: 'raw_refresh_token_456',
      user: {
        id: 'usr-123',
        email: 'admin@mype.pe',
        fullName: 'Admin Demo',
        role: 'ADMIN',
        companyId: 'comp-456',
      },
    };
    mockLoginUseCase.execute.mockResolvedValue(mockAuthResponse);
    const mockRes = createMockResponse();

    const result = await controller.login(
      { email: 'admin@mype.pe', password: 'Password123!#' },
      mockRes,
    );

    expect(result).toBe(mockAuthResponse);
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'raw_refresh_token_456',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('debería cerrar sesión revocando el token y limpiando la cookie', async () => {
    mockLogoutUseCase.execute.mockResolvedValue({
      success: true,
      message: 'Sesión finalizada exitosamente.',
    });
    const mockReq = {
      cookies: { refreshToken: 'cookie_refresh_token' },
      headers: {},
    } as unknown as Request;
    const mockRes = createMockResponse();

    const result = await controller.logout(mockReq, mockRes);

    expect(result.success).toBe(true);
    expect(mockLogoutUseCase.execute).toHaveBeenCalledWith('cookie_refresh_token');
    expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
  });

  it('debería refrescar el token rotando la cookie de refreshToken', async () => {
    mockRefreshTokenUseCase.execute.mockResolvedValue({
      accessToken: 'new.access.token',
      tokenType: 'Bearer',
      expiresInSeconds: 900,
      refreshToken: 'new_rotated_refresh_token',
    });
    const mockReq = {
      headers: { cookie: 'refreshToken=current_token_val' },
    } as unknown as Request;
    const mockRes = createMockResponse();

    const result = await controller.refresh(mockReq, mockRes);

    expect(result.accessToken).toBe('new.access.token');
    expect(mockRefreshTokenUseCase.execute).toHaveBeenCalledWith('current_token_val');
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'new_rotated_refresh_token',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('debería retornar el perfil del usuario autenticado', async () => {
    const mockProfile = {
      id: 'usr-123',
      email: 'admin@mype.pe',
      fullName: 'Admin Demo',
      role: 'ADMIN',
      isActive: true,
      company: {
        id: 'comp-456',
        ruc: '20100070970',
        legalName: 'DEMO S.A.C.',
        tradeName: null,
        isActive: true,
      },
    };
    mockGetProfileUseCase.execute.mockResolvedValue(mockProfile);

    const result = await controller.getProfile(mockUserPayload);

    expect(result).toBe(mockProfile);
    expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith('usr-123', 'comp-456');
  });

  it('debería actualizar los nombres en el perfil', async () => {
    const mockUpdateRes = {
      success: true,
      message: 'Perfil actualizado correctamente.',
      user: {
        id: 'usr-123',
        email: 'admin@mype.pe',
        fullName: 'Carlos Actualizado',
        role: 'ADMIN',
        companyId: 'comp-456',
      },
    };
    mockUpdateProfileUseCase.execute.mockResolvedValue(mockUpdateRes);

    const result = await controller.updateProfile(mockUserPayload, {
      fullName: 'Carlos Actualizado',
    });

    expect(result).toBe(mockUpdateRes);
    expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith(
      'usr-123',
      { fullName: 'Carlos Actualizado' },
    );
  });

  it('debería cambiar contraseña y limpiar la cookie de sesión', async () => {
    mockChangePasswordUseCase.execute.mockResolvedValue({
      success: true,
      message: 'Contraseña actualizada exitosamente.',
    });
    const mockRes = createMockResponse();

    const result = await controller.changePassword(
      mockUserPayload,
      {
        currentPassword: 'Password123!#',
        newPassword: 'NewPassword123!#',
        confirmPassword: 'NewPassword123!#',
      },
      mockRes,
    );

    expect(result.success).toBe(true);
    expect(mockChangePasswordUseCase.execute).toHaveBeenCalledWith(
      'usr-123',
      expect.objectContaining({ newPassword: 'NewPassword123!#' }),
    );
    expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
  });

  it('expone almacenes del usuario autenticado', async () => {
    mockWarehouseAccess.listAllowed.mockResolvedValue([{ warehouse_code: 'ALM-01' }]);
    await expect(controller.warehouses({ sub: 'u', role: 'ADMIN', companyId: 'c' } as any)).resolves.toEqual([{ warehouse_code: 'ALM-01' }]);
  });

  it('solo ADMIN lista y asigna almacenes de usuarios', async () => {
    mockWarehouseAccess.listUsers.mockResolvedValue([{ id: 'u1' }]);
    await expect(controller.users({ sub: 'u', role: 'ADMIN', companyId: 'c' } as any)).resolves.toEqual([{ id: 'u1' }]);
    await expect(controller.setUserWarehouses({ sub: 'u', role: 'ADMIN', companyId: 'c' } as any, 'u1', { warehouseCodes: ['ALM-01'] })).resolves.toBeUndefined();
    await expect(controller.users({ sub: 'u', role: 'CONTADOR', companyId: 'c' } as any)).rejects.toThrow(ForbiddenException);
    await expect(controller.setUserWarehouses({ sub: 'u', role: 'CONTADOR', companyId: 'c' } as any, 'u1', { warehouseCodes: [] })).rejects.toThrow(ForbiddenException);
  });
});
