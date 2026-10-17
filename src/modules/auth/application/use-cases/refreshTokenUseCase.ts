import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../domain/ports/tokenServicePort';

export interface RefreshTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  refreshToken: string;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(rawRefreshToken?: string): Promise<RefreshTokenResponse> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string' || !rawRefreshToken.trim()) {
      throw new UnauthorizedException('Token de refresco no proporcionado.');
    }

    const trimmedToken = rawRefreshToken.trim();
    const tokenHash = this.tokenService.hashToken(trimmedToken);
    const existingToken = await this.userRepository.findRefreshToken(tokenHash);

    if (!existingToken) {
      throw new UnauthorizedException('Token de refresco inválido o no reconocido.');
    }

    if (existingToken.isRevoked) {
      await this.userRepository.revokeAllUserRefreshTokens(existingToken.userId);
      throw new UnauthorizedException(
        'Alerta de seguridad: intento de reutilización de token. Se han cerrado todas las sesiones activas.',
      );
    }

    if (existingToken.isExpired()) {
      throw new UnauthorizedException('La sesión ha caducado. Inicie sesión nuevamente.');
    }

    const user = await this.userRepository.findById(existingToken.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('El usuario asociado a la sesión se encuentra inactivo.');
    }

    await this.userRepository.revokeRefreshToken(tokenHash);

    const newRawRefreshToken = this.tokenService.generateRefreshToken();
    const newTokenHash = this.tokenService.hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 días

    await this.userRepository.saveRefreshToken(user.id, newTokenHash, expiresAt);

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
      refreshToken: newRawRefreshToken,
    };
  }
}
