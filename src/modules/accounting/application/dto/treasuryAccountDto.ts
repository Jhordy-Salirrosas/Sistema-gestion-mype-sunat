import { IsBoolean, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/**
 * Alta de una cuenta de tesorería.
 *
 * `code` es la subcuenta del PCGE que viaja al asiento; `name` es el nombre
 * operativo que ve el usuario. La validación contra el catálogo (existe, activa,
 * no es cuenta de mayor) se hace en el caso de uso, porque necesita la base.
 */
export class CreateTreasuryAccountDto {
  @IsString()
  @Matches(/^\d{3,6}$/, {
    message: 'El código debe ser una subcuenta PCGE numérica de 3 a 6 dígitos.',
  })
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsIn(['CAJA', 'BANCO'])
  kind?: 'CAJA' | 'BANCO';

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'La moneda debe ser un código ISO de 3 letras.' })
  currency?: string;
}

export class UpdateTreasuryAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(['CAJA', 'BANCO'])
  kind?: 'CAJA' | 'BANCO';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
