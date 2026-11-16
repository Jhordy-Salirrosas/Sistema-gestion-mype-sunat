import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Datos editables de la empresa.
 *
 * El RUC NO se recibe aquí: es el identificador fiscal de la empresa
 * autenticada y no se puede cambiar desde la pantalla de configuración.
 */
export class UpdateCompanyConfigurationDto {
  /** Nombre con el que se muestran los reportes de la empresa. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName?: string;

  /** Dirección fiscal devuelta por la consulta RUC de SUNAT. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  direccion?: string;

  /** Estado del contribuyente (por ejemplo `ACTIVO`). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  estado?: string;

  /** Condición del domicilio fiscal (por ejemplo `HABIDO`). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  condicion?: string;

  /** Código de ubigeo de seis dígitos. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'El ubigeo debe tener exactamente 6 dígitos.',
  })
  ubigeo?: string;

  /** Indica si la empresa es agente de retención de IGV. */
  @IsOptional()
  @IsBoolean()
  esAgenteRetencion?: boolean;

  /**
   * Series de comprobantes por defecto (por ejemplo `F001`, `B001`).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[A-Za-z0-9-]{1,10}$/, {
    each: true,
    message: 'Cada serie debe tener entre 1 y 10 caracteres alfanuméricos.',
  })
  series?: string[];
}

/**
 * Variables globales de la empresa que consume el módulo SIRE.
 */
export interface CompanyConfigurationResponse {
  ruc: string;
  businessName: string | null;
  direccion: string | null;
  estado: string | null;
  condicion: string | null;
  ubigeo: string | null;
  esAgenteRetencion: boolean | null;
  series: string[];
}
