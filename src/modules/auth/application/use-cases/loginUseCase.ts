import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../dto/loginDto';
import type { AuthResponseDto } from '../dto/authResponseDto';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../ports/userRepositoryPort';
import { HASHER_PORT, type HasherPort } from '../ports/hasherPort';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../ports/tokenServicePort';

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

    const isValid = await this.hasher.compare(dto.password, passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales de acceso incorrectas.');
    }

    const expiresInSeconds = 28800; // 8 horas
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
