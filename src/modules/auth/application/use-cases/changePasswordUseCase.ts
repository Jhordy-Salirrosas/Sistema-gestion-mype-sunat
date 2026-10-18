import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';
import { HASHER_PORT, type HasherPort } from '../../domain/ports/hasherPort';
import { PasswordStrengthRule } from '../../domain/rules/passwordStrengthRule';
import { ChangePasswordDto } from '../dto/changePasswordDto';

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @Inject(HASHER_PORT)
    private readonly hasher: HasherPort,
  ) {}

  async execute(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'La confirmación de la contraseña no coincide con la nueva contraseña.',
      );
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'La nueva contraseña no puede ser idéntica a la contraseña actual.',
      );
    }

    try {
      PasswordStrengthRule.validate(dto.newPassword);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'La nueva contraseña no cumple los requisitos de seguridad.',
      );
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const record = await this.userRepository.findByEmail(user.email);
    if (!record) {
      throw new NotFoundException('Registro de autenticación no encontrado.');
    }

    const isCurrentValid = await this.hasher.compare(
      dto.currentPassword,
      record.passwordHash,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException(
        'La contraseña actual ingresada es incorrecta.',
      );
    }

    const newPasswordHash = await this.hasher.hash(dto.newPassword);
    await this.userRepository.updatePassword(userId, newPasswordHash);
    await this.userRepository.revokeAllUserRefreshTokens(userId);

    return {
      success: true,
      message:
        'Contraseña actualizada exitosamente. Por favor vuelva a iniciar sesión.',
    };
  }
}
