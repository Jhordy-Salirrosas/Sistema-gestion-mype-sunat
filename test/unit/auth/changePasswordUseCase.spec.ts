import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ChangePasswordUseCase } from '../../../src/modules/auth/application/use-cases/changePasswordUseCase';
import { UserEntity } from '../../../src/modules/auth/domain/entities/userEntity';
import type { UserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';
import type { HasherPort } from '../../../src/modules/auth/domain/ports/hasherPort';

describe('ChangePasswordUseCase', () => {
  let useCase: ChangePasswordUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockHasher: jest.Mocked<HasherPort>;

  const activeUser = new UserEntity({
    id: 'usr-300',
    companyId: 'comp-300',
    email: 'seguridad@mype.pe',
    fullName: 'Seguridad User',
    role: 'ADMIN',
    isActive: true,
  });

  const validDto = {
    currentPassword: 'CurrentPass123!#',
    newPassword: 'NewSecurePass2026$#',
    confirmPassword: 'NewSecurePass2026$#',
  };

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn().mockResolvedValue({
        user: activeUser,
        passwordHash: 'hashed_current_password',
      }),
      findById: jest.fn().mockResolvedValue(activeUser),
      findByRuc: jest.fn(),
      findCompanyById: jest.fn(),
      createUserWithCompany: jest.fn(),
      saveRefreshToken: jest.fn(),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
      updatePassword: jest.fn().mockResolvedValue(undefined),
      updateProfile: jest.fn(),
    };

    mockHasher = {
      hash: jest.fn().mockResolvedValue('hashed_new_password_abc'),
      compare: jest.fn().mockResolvedValue(true),
    };

    useCase = new ChangePasswordUseCase(mockUserRepo, mockHasher);
  });

  it('debería cambiar la contraseña y revocar sesiones previas exitosamente', async () => {
    const result = await useCase.execute('usr-300', validDto);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Contraseña actualizada exitosamente');
    expect(mockHasher.compare).toHaveBeenCalledWith(
      'CurrentPass123!#',
      'hashed_current_password',
    );
    expect(mockHasher.hash).toHaveBeenCalledWith('NewSecurePass2026$#');
    expect(mockUserRepo.updatePassword).toHaveBeenCalledWith(
      'usr-300',
      'hashed_new_password_abc',
    );
    expect(mockUserRepo.revokeAllUserRefreshTokens).toHaveBeenCalledWith('usr-300');
  });

  it('debería lanzar BadRequestException si la confirmación no coincide', async () => {
    await expect(
      useCase.execute('usr-300', {
        ...validDto,
        confirmPassword: 'DifferentPassword123!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debería lanzar BadRequestException si la nueva contraseña es idéntica a la actual', async () => {
    await expect(
      useCase.execute('usr-300', {
        currentPassword: 'Password123!#',
        newPassword: 'Password123!#',
        confirmPassword: 'Password123!#',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debería lanzar BadRequestException si la nueva contraseña es débil', async () => {
    await expect(
      useCase.execute('usr-300', {
        currentPassword: 'CurrentPass123!#',
        newPassword: 'debil',
        confirmPassword: 'debil',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debería lanzar UnauthorizedException si la contraseña actual no coincide', async () => {
    mockHasher.compare.mockResolvedValue(false);

    await expect(useCase.execute('usr-300', validDto)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debería lanzar NotFoundException si el usuario no existe', async () => {
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('usr-inexistente', validDto)).rejects.toThrow(
      NotFoundException,
    );
  });
});
