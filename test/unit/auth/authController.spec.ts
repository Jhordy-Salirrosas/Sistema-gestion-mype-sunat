import { AuthController } from '../../../src/modules/auth/infrastructure/controllers/authController';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/loginUseCase';

describe('AuthController', () => {
  let controller: AuthController;
  let loginUseCase: jest.Mocked<LoginUseCase>;

  beforeEach(() => {
    loginUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<LoginUseCase>;

    controller = new AuthController(loginUseCase);
  });

  it('debería delegar el login al caso de uso', async () => {
    const mockResponse = {
      accessToken: 'token123',
      tokenType: 'Bearer',
      expiresInSeconds: 28800,
      user: {
        id: 'usr-1',
        email: 'admin@mype.pe',
        fullName: 'Admin',
        role: 'ADMIN',
        companyId: 'comp-1',
      },
    };

    loginUseCase.execute.mockResolvedValue(mockResponse);

    const result = await controller.login({
      email: 'admin@mype.pe',
      password: 'Password123!',
    });

    expect(result).toBe(mockResponse);
    expect(loginUseCase.execute).toHaveBeenCalled();
  });

  it('debería devolver el perfil del usuario autenticado', async () => {
    const req = {
      user: {
        sub: 'usr-1',
        email: 'admin@mype.pe',
        companyId: 'comp-1',
        role: 'ADMIN',
      },
    };

    const profile = await controller.getProfile(req);
    expect(profile.authenticated).toBe(true);
    expect(profile.user?.sub).toBe('usr-1');
  });
});
