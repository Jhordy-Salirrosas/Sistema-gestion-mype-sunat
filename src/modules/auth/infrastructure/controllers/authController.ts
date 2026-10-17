import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RegisterDto } from '../../application/dto/registerDto';
import { LoginDto } from '../../application/dto/loginDto';
import { UpdateProfileDto } from '../../application/dto/updateProfileDto';
import { ChangePasswordDto } from '../../application/dto/changePasswordDto';
import type { AuthResponseDto } from '../../application/dto/authResponseDto';
import type { UserProfileResponseDto } from '../../application/dto/userProfileResponseDto';
import { RegisterUseCase } from '../../application/use-cases/registerUseCase';
import { LoginUseCase } from '../../application/use-cases/loginUseCase';
import { LogoutUseCase, type LogoutResponse } from '../../application/use-cases/logoutUseCase';
import {
  RefreshTokenUseCase,
  type RefreshTokenResponse,
} from '../../application/use-cases/refreshTokenUseCase';
import { GetProfileUseCase } from '../../application/use-cases/getProfileUseCase';
import {
  UpdateProfileUseCase,
  type UpdateProfileResponse,
} from '../../application/use-cases/updateProfileUseCase';
import {
  ChangePasswordUseCase,
  type ChangePasswordResponse,
} from '../../application/use-cases/changePasswordUseCase';
import { AuthGuard } from '../guards/authGuard';
import { CurrentUser } from '../decorators/currentUserDecorator';
import type { TokenPayload } from '../../domain/ports/tokenServicePort';
import {
  clearRefreshTokenCookie,
  extractRefreshToken,
  setRefreshTokenCookie,
} from '../utils/cookieHelper';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.registerUseCase.execute(dto);
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.loginUseCase.execute(dto);
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponse> {
    const token = extractRefreshToken(req);
    const result = await this.logoutUseCase.execute(token);
    clearRefreshTokenCookie(res);
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<RefreshTokenResponse, 'refreshToken'>> {
    const token = extractRefreshToken(req);
    const result = await this.refreshTokenUseCase.execute(token);
    setRefreshTokenCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(
    @CurrentUser() user: TokenPayload,
  ): Promise<UserProfileResponseDto> {
    return this.getProfileUseCase.execute(user.sub, user.companyId);
  }

  @Put('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: TokenPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UpdateProfileResponse> {
    return this.updateProfileUseCase.execute(user.sub, dto);
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  async changePassword(
    @CurrentUser() user: TokenPayload,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChangePasswordResponse> {
    const result = await this.changePasswordUseCase.execute(user.sub, dto);
    clearRefreshTokenCookie(res);
    return result;
  }
}
