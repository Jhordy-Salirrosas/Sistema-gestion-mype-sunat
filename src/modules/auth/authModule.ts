import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prismaModule';
import { AuthController } from './infrastructure/controllers/authController';
import { LoginUseCase } from './application/use-cases/loginUseCase';
import { RegisterUseCase } from './application/use-cases/registerUseCase';
import { LogoutUseCase } from './application/use-cases/logoutUseCase';
import { RefreshTokenUseCase } from './application/use-cases/refreshTokenUseCase';
import { GetProfileUseCase } from './application/use-cases/getProfileUseCase';
import { UpdateProfileUseCase } from './application/use-cases/updateProfileUseCase';
import { ChangePasswordUseCase } from './application/use-cases/changePasswordUseCase';
import { USER_REPOSITORY_PORT } from './domain/ports/userRepositoryPort';
import { PrismaUserRepositoryAdapter } from './infrastructure/persistence/prismaUserRepositoryAdapter';
import { HASHER_PORT } from './domain/ports/hasherPort';
import { NativeCryptoHasherAdapter } from './infrastructure/security/nativeCryptoHasherAdapter';
import { TOKEN_SERVICE_PORT } from './domain/ports/tokenServicePort';
import { NativeJwtAdapter } from './infrastructure/security/nativeJwtAdapter';
import { AuthGuard } from './infrastructure/guards/authGuard';
import { RolesGuard } from './infrastructure/guards/rolesGuard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    RegisterUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshTokenUseCase,
    GetProfileUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
    {
      provide: USER_REPOSITORY_PORT,
      useClass: PrismaUserRepositoryAdapter,
    },
    {
      provide: HASHER_PORT,
      useClass: NativeCryptoHasherAdapter,
    },
    {
      provide: TOKEN_SERVICE_PORT,
      useClass: NativeJwtAdapter,
    },
    AuthGuard,
    RolesGuard,
  ],
  exports: [
    RegisterUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshTokenUseCase,
    GetProfileUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
    TOKEN_SERVICE_PORT,
    HASHER_PORT,
    USER_REPOSITORY_PORT,
    AuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
