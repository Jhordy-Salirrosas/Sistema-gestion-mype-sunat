import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Credenciales SIRE/SUNAT de la empresa.
 *
 * Los cuatro campos son OPCIONALES: una empresa puede guardar sus credenciales
 * de API (`clientId`/`clientSecret`) y las de SOL (`solUser`/`solPassword`) en
 * momentos distintos. Lo que no se informa se conserva tal como estaba.
 *
 * Lo que NUNCA se acepta aquí es el RUC: sale de la empresa autenticada.
 */
export class SireConfiguracionRequestDto {
  /**
   * Empresa destino. Solo un ADMIN puede usar una empresa distinta a la del
   * token; para el resto se ignora y se usa la empresa autenticada.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  companyId?: string;

  /** Client ID de la aplicación en la API SIRE de SUNAT. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clientId?: string;

  /** Client Secret de la aplicación en la API SIRE de SUNAT. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  clientSecret?: string;

  /** Usuario SOL (clave SOL) del contribuyente. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\S+$/)
  @MaxLength(50)
  solUser?: string;

  /** Contraseña de la clave SOL del contribuyente. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  solPassword?: string;
}

/**
 * Estado de la configuración SIRE de la empresa.
 *
 * `configured` es `true` cuando la empresa tiene las cuatro credenciales
 * necesarias para consultar la API SIRE de SUNAT.
 */
export interface SireConfiguracionEstadoResponse {
  configured: boolean;
}

export interface SireConfiguracionGuardadaResponse
  extends SireConfiguracionEstadoResponse {
  success: true;
  message: string;
  companyId: string;
}
