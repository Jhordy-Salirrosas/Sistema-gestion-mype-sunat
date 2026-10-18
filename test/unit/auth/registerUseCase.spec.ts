import { BadRequestException, ConflictException } from '@nestjs/common';
import { RegisterUseCase } from '../../../src/modules/auth/application/use-cases/registerUseCase';
import { CompanyEntity } from '../../../src/modules/auth/domain/entities/companyEntity';
import { UserEntity } from '../../../src/modules/auth/domain/entities/userEntity';
import type { UserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import type { HasherPort } from '../../../src/modules/auth/domain/ports/hasherPort';
import type { TokenServicePort } from '../../../src/modules/auth/domain/ports/tokenServicePort';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockHasher: jest.Mocked<HasherPort>;
  let mockTokenService: jest.Mocked<TokenServicePort>;

  const validDto = {
    ruc: '20100070970',
    legalName: 'MYPE INNOVADORA S.A.C.',
    tradeName: 'MYPE INNOVADORA',
    solUser: 'MODDATOS',
    solPassword: 'PasswordSol123!',
    fullName: 'Carlos Administrador',
    email: 'admin@mypeinnovadora.pe',
    password: 'Password123!#',
  };

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      findByRuc: jest.fn().mockResolvedValue(null),
      findCompanyById: jest.fn().mockResolvedValue(null),
      createUserWithCompany: jest.fn().mockImplementation(async (params) => ({
        user: params.user,
        company: params.company,
      })),
      saveRefreshToken: jest.fn(),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllUserRefreshTokens: jest.fn(),
      updatePassword: jest.fn(),
      updateProfile: jest.fn(),
    };

    mockHasher = {
      hash: jest.fn().mockResolvedValue('hashed_password_123'),
      compare: jest.fn(),
    };

    mockTokenService = {
      signToken: jest.fn().mockReturnValue('mocked.jwt.token.register'),
      verifyToken: jest.fn(),
      generateRefreshToken: jest.fn().mockReturnValue('random_raw_refresh_token'),
      hashToken: jest.fn().mockReturnValue('hash_of_raw_refresh_token'),
    };

    useCase = new RegisterUseCase(mockUserRepo, mockHasher, mockTokenService);
  });

  it('debería registrar una nueva empresa y usuario ADMIN exitosamente', async () => {
    const result = await useCase.execute(validDto);

    expect(result.accessToken).toBe('mocked.jwt.token.register');
    expect(result.refreshToken).toBe('random_raw_refresh_token');
    expect(result.user.email).toBe('admin@mypeinnovadora.pe');
    expect(result.user.role).toBe('ADMIN');
    expect(mockUserRepo.createUserWithCompany).toHaveBeenCalledWith(
      expect.objectContaining({
        company: expect.any(CompanyEntity),
        user: expect.any(UserEntity),
        passwordHash: 'hashed_password_123',
        initialRefreshToken: expect.objectContaining({
          tokenHash: 'hash_of_raw_refresh_token',
        }),
      }),
    );
  });

  it('debería lanzar BadRequestException si el RUC no cumple Módulo 11', async () => {
    await expect(
      useCase.execute({
        ...validDto,
        ruc: '20100070971', // RUC inválido
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debería lanzar BadRequestException si la contraseña no cumple la regla de fortaleza', async () => {
    await expect(
      useCase.execute({
        ...validDto,
        password: 'debil',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debería lanzar ConflictException si el RUC ya está registrado', async () => {
    mockUserRepo.findByRuc.mockResolvedValue(
      new CompanyEntity({
        id: 'comp-existente',
        ruc: validDto.ruc,
        legalName: 'OTRA EMPRESA S.A.C.',
        solUser: 'MODDATOS',
        solPassEncrypted: 'enc',
        isActive: true,
      }),
    );

    await expect(useCase.execute(validDto)).rejects.toThrow(ConflictException);
  });

  it('debería lanzar ConflictException si el correo electrónico ya está registrado', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({
      user: new UserEntity({
        id: 'usr-existente',
        companyId: 'comp-1',
        email: validDto.email,
        fullName: 'Otro Usuario',
        role: 'ADMIN',
        isActive: true,
      }),
      passwordHash: 'hash',
    });

    await expect(useCase.execute(validDto)).rejects.toThrow(ConflictException);
  });
});
