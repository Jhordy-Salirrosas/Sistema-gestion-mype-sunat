import { parseIssuerKey } from '../modules/sunat/issuerConfigEncryption';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
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

export enum SireEnvironment {
  Mock = 'mock',
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

  @IsNumber()
  @IsOptional()
  SUNAT_TIMEOUT_MS: number = 30000;

  @IsString()
  @IsNotEmpty({
    message:
      'DATABASE_URL es obligatoria para la conexión a Supabase/PostgreSQL',
  })
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty({ message: 'API_KEY es obligatoria para proteger los endpoints' })
  API_KEY: string;

  @IsString()
  @IsNotEmpty({
    message:
      'JWT_SECRET es obligatoria para la autenticación de usuarios y aislamiento multi-tenant',
  })
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty({
    message:
      'SOL_CREDENTIALS_ENCRYPTION_KEY es obligatoria para proteger credenciales SOL',
  })
  SOL_CREDENTIALS_ENCRYPTION_KEY: string;

  @IsString()
  @IsNotEmpty({ message: 'RUC_EMISOR es obligatorio' })
  RUC_EMISOR: string;

  @IsString()
  @IsNotEmpty({
    message: 'CERT_PASSWORD es obligatorio para abrir el certificado digital',
  })
  CERT_PASSWORD: string;

  @IsString()
  @IsNotEmpty({ message: 'CERT_BASE64 es obligatorio para firmar los XML' })
  CERT_BASE64: string;

  @IsEnum(SunatEnvironment)
  @IsOptional()
  SUNAT_ENV: SunatEnvironment = SunatEnvironment.Beta;

  @IsEnum(SireEnvironment)
  @IsOptional()
  SUNAT_SIRE_ENV: SireEnvironment = SireEnvironment.Beta;

  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  SUNAT_SIRE_INTEGRATION_ENABLED = false;

  @ValidateIf((config) => config.SUNAT_SIRE_INTEGRATION_ENABLED === true)
  @IsString()
  @IsNotEmpty()
  SIRE_AUTH_HOST?: string;

  @ValidateIf((config) => config.SUNAT_SIRE_INTEGRATION_ENABLED === true)
  @IsString()
  @IsNotEmpty()
  SIRE_API_HOST?: string;

  @ValidateIf((config) => config.SUNAT_SIRE_INTEGRATION_ENABLED === true)
  @IsString()
  @IsNotEmpty()
  SUNAT_CLIENT_ID?: string;

  @ValidateIf((config) => config.SUNAT_SIRE_INTEGRATION_ENABLED === true)
  @IsString()
  @IsNotEmpty()
  SUNAT_CLIENT_SECRET?: string;

  @IsNumber()
  @IsOptional()
  SUNAT_SIRE_READONLY_TIMEOUT_MS = 10000;

  @IsString()
  @IsOptional()
  SUNAT_SOL_USER?: string;

  @IsString()
  @IsOptional()
  SUNAT_SOL_PASSWORD?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  SUNAT_BILL_SERVICE_URL?: string;

  @IsUrl({ protocols: ['https'], require_tld: true })
  @IsOptional()
  SUNAT_BILL_SERVICE_URL_BETA: string =
    'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService';

  @IsUrl({ protocols: ['https'], require_tld: true })
  @IsOptional()
  SUNAT_BILL_SERVICE_URL_PRODUCCION: string =
    'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService';

  @IsString()
  @IsOptional()
  SUNAT_RUC_SERVICE_URL?: string;

  @IsString()
  @IsOptional()
  SUNAT_RUC_SERVICE_API_KEY?: string;

  @IsNumber()
  @IsOptional()
  SUNAT_RUC_CACHE_TTL_SECONDS: number = 86400;
}

export function validate(config: Record<string, unknown>) {
  // Encryption is optional for legacy deployments. Invalid keys disable new
  // encrypted writes (the encryption service enforces this), not legacy reads.
  const issuerEncryptionAvailable = Boolean(
    typeof config.ISSUER_CONFIG_ENCRYPTION_KEY === 'string' &&
    parseIssuerKey(config.ISSUER_CONFIG_ENCRYPTION_KEY),
  );
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(
      (error) =>
        `\n - ${error.property}: ${Object.values(error.constraints || {}).join(', ')}`,
    );
    throw new Error(
      `\n❌ Error de configuración. Faltan variables de entorno obligatorias:${errorMessages.join('')}\n`,
    );
  }

  if (
    validatedConfig.NODE_ENV === Environment.Production &&
    validatedConfig.SUNAT_SIRE_ENV === SireEnvironment.Mock
  ) {
    throw new Error(
      'SUNAT_SIRE_ENV=mock no está permitido cuando NODE_ENV=production.',
    );
  }

  if (validatedConfig.SUNAT_SIRE_INTEGRATION_ENABLED) {
    const clientId = validatedConfig.SUNAT_CLIENT_ID?.trim();
    if (
      !clientId ||
      /^(tu-|your-|placeholder|inyectar-)|^<.*>$|sin-espacios$/i.test(clientId)
    ) {
      throw new Error(
        'SUNAT_CLIENT_ID debe contener el Client ID real de la aplicación SUNAT; no se aceptan valores de ejemplo.',
      );
    }

    const endpoints = [
      {
        value: validatedConfig.SIRE_AUTH_HOST!,
        expectedHost: 'api-seguridad.sunat.gob.pe',
      },
      {
        value: validatedConfig.SIRE_API_HOST!,
        expectedHost: 'api-sire.sunat.gob.pe',
      },
    ];
    for (const { value: endpoint, expectedHost } of endpoints) {
      let url: URL;
      try {
        url = new URL(endpoint);
      } catch {
        throw new Error(
          'Las URLs configuradas para SIRE deben ser válidas y oficiales.',
        );
      }

      const host = url.hostname.toLowerCase();
      if (
        url.protocol !== 'https:' ||
        url.port !== '' ||
        host !== expectedHost ||
        (url.pathname !== '/' && url.pathname !== '') ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error(
          'SIRE_AUTH_HOST debe usar https://api-seguridad.sunat.gob.pe y SIRE_API_HOST debe usar https://api-sire.sunat.gob.pe, sin rutas ni credenciales adicionales.',
        );
      }
    }
  }

  return Object.assign(validatedConfig, {
    ISSUER_CONFIG_ENCRYPTION_AVAILABLE: issuerEncryptionAvailable,
  });
}
