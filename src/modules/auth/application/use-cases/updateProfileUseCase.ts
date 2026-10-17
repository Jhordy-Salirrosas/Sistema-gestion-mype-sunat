import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';
import { UpdateProfileDto } from '../dto/updateProfileDto';
import { UserMapper } from '../mappers/userMapper';
import type { AuthUserResponse } from '../dto/authResponseDto';

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  user: AuthUserResponse;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UpdateProfileResponse> {
    const trimmed = dto.fullName ? dto.fullName.trim() : '';
    if (trimmed.length < 3) {
      throw new BadRequestException(
        'El nombre completo debe tener al menos 3 caracteres.',
      );
    }

    const updatedUser = await this.userRepository.updateProfile(userId, trimmed);

    return {
      success: true,
      message: 'Perfil actualizado correctamente.',
      user: UserMapper.toAuthUserResponse(updatedUser),
    };
  }
}
