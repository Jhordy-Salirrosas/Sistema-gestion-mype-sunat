import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RegisterDto } from '../dto/registerDto';
import type { AuthResponseDto } from '../dto/authResponseDto';
import { UserEntity } from '../../domain/entities/userEntity';
import { CompanyEntity } from '../../domain/entities/companyEntity';
import { RucVo } from '../../domain/value-objects/rucVo';
import { PasswordStrengthRule } from '../../domain/rules/passwordStrengthRule';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';
import { HASHER_PORT, type HasherPort } from '../../domain/ports/hasherPort';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../domain/ports/tokenServicePort';

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(HASHER_PORT)
    private readonly hasher: HasherPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthResponseDto> {
    try {
      RucVo.create(dto.ruc);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'El RUC no es válido.',
      );
    }

    try {
      PasswordStrengthRule.validate(dto.password);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'La contraseña no cumple los requisitos de seguridad.',
      );
    }

    const existingCompany = await this.userRepository.findByRuc(dto.ruc);
    if (existingCompany) {
      throw new ConflictException('El RUC ya se encuentra registrado en el sistema.');
    }

    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }

    const companyId = randomUUID();
    const userId = randomUUID();
    const passwordHash = await this.hasher.hash(dto.password);

    const company = new CompanyEntity({
      id: companyId,
      ruc: dto.ruc,
      legalName: dto.legalName,
      tradeName: dto.tradeName ?? null,
      solUser: dto.solUser,
      solPassEncrypted: dto.solPassword,
      isActive: true,
    });

    const user = new UserEntity({
      id: userId,
      companyId,
      email: dto.email.trim().toLowerCase(),
      fullName: dto.fullName.trim(),
      role: 'ADMIN',
      isActive: true,
    });

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 días

    await this.userRepository.createUserWithCompany({
      user,
      company,
      passwordHash,
      initialRefreshToken: {
        tokenHash,
        expiresAt,
      },
    });

    const expiresInSeconds = 900; // 15 minutos
    const accessToken = this.tokenService.signToken(
      {
        sub: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      expiresInSeconds,
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresInSeconds,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }
}
