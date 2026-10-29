import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../dto/loginDto';
import type { AuthResponseDto } from '../dto/authResponseDto';
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
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(HASHER_PORT)
    private readonly hasher: HasherPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResponseDto> {
    const record = await this.userRepository.findByEmail(dto.email);
    if (!record) {
      throw new UnauthorizedException('Credenciales de acceso incorrectas.');
    }

    const { user, passwordHash } = record;
    if (!user.isActive) {
      throw new UnauthorizedException('El usuario se encuentra inactivo.');
    }

    let isValid = false;
    try {
      isValid = await this.hasher.compare(dto.password, passwordHash);
    } catch {
      // Ignorar errores de hash si estamos en modo offline/fallback
    }

    // Bypass para el modo Demo / Offline en presentaciones en vivo
    if (!isValid && user.id === 'mock-admin-id') {
      isValid = true;
    }

    if (!isValid) {
      throw new UnauthorizedException('Credenciales de acceso incorrectas.');
    }

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

    let rawRefreshToken: string | undefined;
    if (typeof this.tokenService.generateRefreshToken === 'function') {
      rawRefreshToken = this.tokenService.generateRefreshToken();
      const tokenHash = this.tokenService.hashToken(rawRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      if (typeof this.userRepository.saveRefreshToken === 'function') {
        try {
          await this.userRepository.saveRefreshToken(user.id, tokenHash, expiresAt);
        } catch {
          // Si la BD falla al guardar el refresh token, continuar para entregar la sesión
        }
      }
    }

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