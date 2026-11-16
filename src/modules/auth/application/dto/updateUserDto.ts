import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
export class UpdateUserDto {
  @IsOptional() @IsString() @Matches(/^[A-Z][A-Z0-9_]{0,63}$/) role?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
