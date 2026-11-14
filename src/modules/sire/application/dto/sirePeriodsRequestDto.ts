import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Solicitud de consulta de períodos SIRE.
 *
 * `bookCode` es lo único que sigue siendo obligatorio: identifica el libro
 * (140000 = RVIE, 080000 = RCE).
 *
 * `solUser` y `solPassword` se conservan como campos OPCIONALES y DEPRECADOS
 * para no romper a los clientes que todavía los envían: el backend los ignora
 * y las credenciales se resuelven de la configuración SIRE de la empresa
 * (`POST /api/v1/sire/configuracion`).
 */
export class SirePeriodsRequestDto {
  @IsString()
  @IsIn(['140000', '080000'])
  bookCode!: '140000' | '080000';

  /**
   * @deprecated Las credenciales SOL se guardan en la configuración SIRE de la
   * empresa. Este campo se ignora.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/)
  @MaxLength(50)
  solUser?: string;

  /**
   * @deprecated Las credenciales SOL se guardan en la configuración SIRE de la
   * empresa. Este campo se ignora.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  solPassword?: string;
}
