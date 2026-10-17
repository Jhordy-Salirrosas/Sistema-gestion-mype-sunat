import { BadRequestException } from '@nestjs/common';
import { UpdateProfileUseCase } from '../../../src/modules/auth/application/use-cases/updateProfileUseCase';
import { UserEntity } from '../../../src/modules/auth/domain/entities/userEntity';
import type { UserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';

describe('UpdateProfileUseCase', () => {
  let useCase: UpdateProfileUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;

  const initialUser = new UserEntity({
    id: 'usr-200',
    companyId: 'comp-200',
    email: 'carlos@mype.pe',
    fullName: 'Carlos Original',
    role: 'ADMIN',
    isActive: true,
  });

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByRuc: jest.fn(),
      findCompanyById: jest.fn(),
      createUserWithCompany: jest.fn(),
      saveRefreshToken: jest.fn(),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllUserRefreshTokens: jest.fn(),
      updatePassword: jest.fn(),
      updateProfile: jest.fn().mockImplementation(async (userId, fullName) => {
        return initialUser.updateFullName(fullName);
      }),
    };

    useCase = new UpdateProfileUseCase(mockUserRepo);
  });

  it('debería actualizar el nombre completo del usuario correctamente', async () => {
    const result = await useCase.execute('usr-200', {
      fullName: 'Carlos Ahumada Modificado',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Perfil actualizado correctamente.');
    expect(result.user.fullName).toBe('Carlos Ahumada Modificado');
    expect(mockUserRepo.updateProfile).toHaveBeenCalledWith(
      'usr-200',
      'Carlos Ahumada Modificado',
    );
  });

  it('debería lanzar BadRequestException si el nombre completo tiene menos de 3 caracteres', async () => {
    await expect(
      useCase.execute('usr-200', {
        fullName: '  ab  ',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
