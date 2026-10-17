import { NotFoundException } from '@nestjs/common';
import { GetProfileUseCase } from '../../../src/modules/auth/application/use-cases/getProfileUseCase';
import { UserEntity } from '../../../src/modules/auth/domain/entities/userEntity';
import { CompanyEntity } from '../../../src/modules/auth/domain/entities/companyEntity';
import type { UserRepositoryPort } from '../../../src/modules/auth/domain/ports/userRepositoryPort';

describe('GetProfileUseCase', () => {
  let useCase: GetProfileUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;

  const company = new CompanyEntity({
    id: 'comp-100',
    ruc: '20601234567',
    legalName: 'MYPE CENTRAL S.A.C.',
    tradeName: 'MYPE CENTRAL',
    solUser: 'MODDATOS',
    solPassEncrypted: 'enc',
    isActive: true,
  });

  const user = new UserEntity({
    id: 'usr-100',
    companyId: 'comp-100',
    email: 'contador@mypecentral.pe',
    fullName: 'Ana Contadora',
    role: 'CONTADOR',
    isActive: true,
  });

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn().mockResolvedValue(user),
      findByRuc: jest.fn(),
      findCompanyById: jest.fn().mockResolvedValue(company),
      createUserWithCompany: jest.fn(),
      saveRefreshToken: jest.fn(),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllUserRefreshTokens: jest.fn(),
      updatePassword: jest.fn(),
      updateProfile: jest.fn(),
    };

    useCase = new GetProfileUseCase(mockUserRepo);
  });

  it('debería retornar los datos completos del perfil del usuario y su empresa', async () => {
    const result = await useCase.execute('usr-100', 'comp-100');

    expect(result.id).toBe('usr-100');
    expect(result.email).toBe('contador@mypecentral.pe');
    expect(result.fullName).toBe('Ana Contadora');
    expect(result.role).toBe('CONTADOR');
    expect(result.company.id).toBe('comp-100');
    expect(result.company.ruc).toBe('20601234567');
    expect(result.company.legalName).toBe('MYPE CENTRAL S.A.C.');
  });

  it('debería lanzar NotFoundException si el usuario no existe', async () => {
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('usr-no-existe')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('debería lanzar NotFoundException si la empresa del usuario no existe', async () => {
    mockUserRepo.findCompanyById.mockResolvedValue(null);

    await expect(useCase.execute('usr-100')).rejects.toThrow(NotFoundException);
  });
});
