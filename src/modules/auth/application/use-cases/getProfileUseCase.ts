import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../domain/ports/userRepositoryPort';
import { UserMapper } from '../mappers/userMapper';
import type { UserProfileResponseDto } from '../dto/userProfileResponseDto';

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(userId: string, companyId?: string): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findById(userId, companyId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const company = await this.userRepository.findCompanyById(user.companyId);
    if (!company) {
      throw new NotFoundException('Empresa asociada no encontrada en el sistema.');
    }

    return UserMapper.toUserProfileResponse(user, company);
  }
}
