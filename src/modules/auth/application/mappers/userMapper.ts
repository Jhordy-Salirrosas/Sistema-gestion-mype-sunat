import { UserEntity } from '../../domain/entities/userEntity';
import { CompanyEntity } from '../../domain/entities/companyEntity';
import type { AuthUserResponse } from '../dto/authResponseDto';
import type { UserProfileResponseDto } from '../dto/userProfileResponseDto';

export class UserMapper {
  static toAuthUserResponse(user: UserEntity): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
    };
  }

  static toUserProfileResponse(
    user: UserEntity,
    company: CompanyEntity,
  ): UserProfileResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      company: {
        id: company.id,
        ruc: company.ruc,
        legalName: company.legalName,
        tradeName: company.tradeName,
        isActive: company.isActive,
      },
    };
  }
}
