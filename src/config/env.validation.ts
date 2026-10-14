import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum SunatEnvironment {
  Beta = 'beta',
  Produccion = 'produccion',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL es obligatoria para la conexión a Supabase/PostgreSQL' })
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty({ message: 'API_KEY es obligatoria para proteger los endpoints' })
  API_KEY: string;

  @IsString()
  @IsNotEmpty({ message: 'RUC_EMISOR es obligatorio' })
  RUC_EMISOR: string;

  @IsString()
  @IsNotEmpty({ message: 'CERT_PASSWORD es obligatorio para abrir el certificado digital' })
  CERT_PASSWORD: string;

  @IsString()
  @IsNotEmpty({ message: 'CERT_BASE64 es obligatorio para firmar los XML' })
  CERT_BASE64: string;

  @IsEnum(SunatEnvironment)
  @IsOptional()
  SUNAT_ENV: SunatEnvironment = SunatEnvironment.Beta;

  @IsString()
  @IsOptional()
  SUNAT_SOL_USER?: string;

  @IsString()
  @IsOptional()
  SUNAT_SOL_PASSWORD?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  SUNAT_BILL_SERVICE_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(
      (error) => `\n - ${error.property}: ${Object.values(error.constraints || {}).join(', ')}`
    );
    throw new Error(`\n❌ Error de configuración. Faltan variables de entorno obligatorias:${errorMessages.join('')}\n`);
  }

  return validatedConfig;
}
