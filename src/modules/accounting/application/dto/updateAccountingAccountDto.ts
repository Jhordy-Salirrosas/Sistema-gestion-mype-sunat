import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Edición de una cuenta del catálogo.
 *
 * Solo se permite el nombre (por ejemplo, para ajustar la denominación al PCGE
 * vigente) y el estado activo/inactivo. El código no se cambia: está referenciado
 * por las líneas de asientos ya registrados.
 */
export class UpdateAccountingAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
