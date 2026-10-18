import type { Request, Response } from 'express';
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

    controller = new AuthController(
      mockRegisterUseCase,
      mockLoginUseCase,
      mockLogoutUseCase,
      mockRefreshTokenUseCase,
      mockGetProfileUseCase,
      mockUpdateProfileUseCase,
      mockChangePasswordUseCase,
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
      mockRes,
    );

    expect(result).toBe(mockAuthResponse);
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'raw_refresh_token_123',
      expect.objectContaining({ httpOnly: true }),
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
});
