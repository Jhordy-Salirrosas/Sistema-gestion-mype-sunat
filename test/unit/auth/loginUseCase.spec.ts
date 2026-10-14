import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/loginUseCase';
import { UserEntity } from '../../../src/modules/auth/domain/entities/userEntity';
import type { UserRepositoryPort } from '../../../src/modules/auth/application/ports/userRepositoryPort';
import type { HasherPort } from '../../../src/modules/auth/application/ports/hasherPort';
import type { TokenServicePort } from '../../../src/modules/auth/application/ports/tokenServicePort';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockHasher: jest.Mocked<HasherPort>;
  let mockTokenService: jest.Mocked<TokenServicePort>;

  const activeUser = new UserEntity({
    id: 'usr-123',
    companyId: 'comp-456',
    email: 'contador@mype.pe',
    fullName: 'Carlos Contador',
    role: 'CONTADOR',
    isActive: true,
  });

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    mockHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    mockTokenService = {
      signToken: jest.fn().mockReturnValue('mocked.jwt.token'),
      verifyToken: jest.fn(),
    };

    useCase = new LoginUseCase(mockUserRepo, mockHasher, mockTokenService);
  });

  it('debería autenticar correctamente con credenciales válidas', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({
      user: activeUser,
      passwordHash: 'hashed_password',
    });
    mockHasher.compare.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'contador@mype.pe',
      password: 'Password123!',
    });

    expect(result.accessToken).toBe('mocked.jwt.token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.user.email).toBe('contador@mype.pe');
    expect(result.user.role).toBe('CONTADOR');
    expect(mockTokenService.signToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'usr-123', role: 'CONTADOR' }),
      28800,
    );
  });

  it('debería fallar si el usuario no existe', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'inexistente@mype.pe', password: 'Password123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('debería fallar si el usuario está inactivo', async () => {
    const inactiveUser = new UserEntity({
      id: 'usr-999',
      companyId: 'comp-456',
      email: 'inactivo@mype.pe',
      fullName: 'Usuario Inactivo',
      role: 'OPERADOR_FACTURACION',
      isActive: false,
    });

    mockUserRepo.findByEmail.mockResolvedValue({
      user: inactiveUser,
      passwordHash: 'hashed_password',
    });

    await expect(
      useCase.execute({ email: 'inactivo@mype.pe', password: 'Password123!' }),
    ).rejects.toThrow('El usuario se encuentra inactivo.');
  });

  it('debería fallar si la contraseña no coincide', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({
      user: activeUser,
      passwordHash: 'hashed_password',
    });
    mockHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'contador@mype.pe', password: 'WrongPassword!' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
