import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../domain/ports/tokenServicePort';

export interface LogoutResponse {
  success: boolean;
  message: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(refreshToken?: string): Promise<LogoutResponse> {
    if (refreshToken && typeof refreshToken === 'string') {
      const tokenHash = this.tokenService.hashToken(refreshToken.trim());
      await this.userRepository.revokeRefreshToken(tokenHash);
    }

    return {
      success: true,
      message: 'Sesión finalizada exitosamente.',
    };
  }
}
