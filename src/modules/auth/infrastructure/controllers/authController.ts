import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LoginDto } from '../../application/dto/loginDto';
import type { AuthResponseDto } from '../../application/dto/authResponseDto';
import { LoginUseCase } from '../../application/use-cases/loginUseCase';
import { AuthGuard } from '../guards/authGuard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.loginUseCase.execute(dto);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@Req() req: any): Promise<any> {
    return {
      authenticated: true,
      user: req.user,
    };
  }
}
