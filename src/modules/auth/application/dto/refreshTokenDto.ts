import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'El token de refresco debe ser una cadena de texto.' })
  @IsOptional()
  refreshToken?: string;
}
