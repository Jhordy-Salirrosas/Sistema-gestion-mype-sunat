import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

/** Elementos del PCGE admitidos como tipo de cuenta. */
export const ELEMENTOS_PCGE = [
  'Activo',
  'Activo realizable',
  'Activo inmovilizado',
  'Pasivo',
  'Patrimonio',
  'Gastos',
  'Ingresos',
  'Saldos intermediarios',
  'Costos de producción',
] as const;

/**
 * Edición de una cuenta del catálogo.
 *
 * Se permite cambiar el nombre, el tipo (elemento del PCGE) y el estado
 * activo/inactivo. El código no se cambia: está referenciado por las líneas de
 * asientos ya registrados.
 */
export class UpdateAccountingAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsIn(ELEMENTOS_PCGE)
  element?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
