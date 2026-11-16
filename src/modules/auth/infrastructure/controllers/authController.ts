import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Patch,
  Req,
  Param,
  ForbiddenException,
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
import { WarehouseAccessService } from '../../application/services/warehouseAccessService';
import { SetUserWarehousesDto } from '../../application/dto/setUserWarehousesDto';
import { UpdateUserDto } from '../../application/dto/updateUserDto';
import { ActionPermissionsService } from '../../application/services/actionPermissionsService';
import { ModulePermissionsService } from '../../application/services/modulePermissionsService';
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
    private readonly warehouseAccess: WarehouseAccessService,
    private readonly modulePermissions: ModulePermissionsService,
    private readonly actionPermissions: ActionPermissionsService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.registerUseCase.execute(dto, {
      ipAddress: req.ip || 'desconocida',
      userAgent: req.get('user-agent') ?? null,
    });
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

  @Get('warehouses')
  @UseGuards(AuthGuard)
  async warehouses(@CurrentUser() user: TokenPayload) {
    return this.warehouseAccess.listAllowed(user);
  }

  @Get('module-permissions/me')
  @UseGuards(AuthGuard)
  async myModulePermissions(@CurrentUser() user: TokenPayload) { return this.modulePermissions.forRole(user.companyId, user.role); }

  @Get('module-permissions')
  @UseGuards(AuthGuard)
  async modulePermissionsList(@CurrentUser() user: TokenPayload) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar permisos.');
    return this.modulePermissions.list(user.companyId);
  }

  @Put('module-permissions')
  @UseGuards(AuthGuard)
  async saveModulePermissions(@CurrentUser() user: TokenPayload, @Body() rows: Array<{ role: string; moduleCode: string; canView: boolean; canWrite: boolean }>) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar permisos.');
    return this.modulePermissions.replace(user.companyId, rows);
  }

  @Get('action-permissions/me')
  @UseGuards(AuthGuard)
  async myActionPermissions(@CurrentUser() user: TokenPayload) {
    return this.actionPermissions.forRole(user.companyId, user.role);
  }

  @Get('action-permissions')
  @UseGuards(AuthGuard)
  async actionPermissionsList(@CurrentUser() user: TokenPayload) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar permisos.');
    return this.actionPermissions.list(user.companyId);
  }

  @Put('action-permissions')
  @UseGuards(AuthGuard)
  async saveActionPermissions(@CurrentUser() user: TokenPayload, @Body() rows: unknown) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar permisos.');
    return this.actionPermissions.replace(user.companyId, rows);
  }

  @Get('users')
  @UseGuards(AuthGuard)
  async users(@CurrentUser() user: TokenPayload) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar usuarios.');
    return this.warehouseAccess.listUsers(user.companyId);
  }

  @Patch('users/:id')
  @UseGuards(AuthGuard)
  async updateUser(@CurrentUser() user: TokenPayload, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar usuarios.');
    return this.warehouseAccess.updateUser(user.companyId, id, user.sub, dto);
  }

  @Put('users/:id/warehouses')
  @UseGuards(AuthGuard)
  async setUserWarehouses(@CurrentUser() user: TokenPayload, @Param('id') id: string, @Body() dto: SetUserWarehousesDto) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar almacenes.');
    return this.warehouseAccess.setUserWarehouses(user.companyId, id, dto.warehouseCodes);
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
