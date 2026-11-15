import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const ROLES_USUARIO = ['ADMIN', 'CONTADOR', 'OPERADOR_FACTURACION', 'OPERADOR_ADUANAS', 'AUDITOR'] as const;
export class UpdateUserDto {
  @IsOptional() @IsIn(ROLES_USUARIO as unknown as string[]) role?: typeof ROLES_USUARIO[number];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
