import 'reflect-metadata';
import { validate } from '../../../src/config/env.validation';

describe('Validación de Variables de Entorno (TT-10)', () => {
  it('debe lanzar una excepción detallada si falta DATABASE_URL', () => {
    const mockInvalidConfig = {
      PORT: '3000',
      NODE_ENV: 'development',
      // DATABASE_URL no está definido aquí
      DIRECT_URL: 'postgres://valid',
      SUPABASE_URL: 'http://valid',
      SUPABASE_KEY: 'valid',
      RUC_EMISOR: '20601234567',
      CERT_PASSWORD: '123',
      CERT_BASE64: 'base64',
      API_KEY: 'clave-falsa',
      SOL_CREDENTIALS_ENCRYPTION_KEY:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    };

    expect(() => validate(mockInvalidConfig)).toThrow(/Error de configuración/);
    expect(() => validate(mockInvalidConfig)).toThrow(/DATABASE_URL/);
  });

  it('debe aprobar y retornar la configuración si todas las variables críticas existen', () => {
    const mockValidConfig = {
      PORT: '3000',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://valid-database',
      DIRECT_URL: 'postgres://valid-direct',
      SUPABASE_URL: 'http://valid',
      SUPABASE_KEY: 'valid',
      RUC_EMISOR: '20601234567',
      CERT_PASSWORD: '123',
      CERT_BASE64: 'base64',
      API_KEY: 'clave-falsa',
      JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
      SOL_CREDENTIALS_ENCRYPTION_KEY:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    };

    const result = validate(mockValidConfig);
    expect(result).toBeDefined();
    expect(result.DATABASE_URL).toBe('postgres://valid-database');
    expect(result.JWT_SECRET).toBe('jwt-secreto-seguro-de-prueba');
  });

  it('debe definir Beta por defecto y validar los endpoints HTTPS de SUNAT', () => {
    const result = validate({
      DATABASE_URL: 'postgres://valid-database',
      API_KEY: 'clave-falsa',
      JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
      SOL_CREDENTIALS_ENCRYPTION_KEY:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      RUC_EMISOR: '20000000001',
      CERT_PASSWORD: '123',
      CERT_BASE64: 'base64',
    });

    expect(result.SUNAT_ENV).toBe('beta');
    expect(result.SUNAT_SIRE_ENV).toBe('beta');
    expect(result.SUNAT_BILL_SERVICE_URL_BETA).toBe(
      'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    );
    expect(result.SUNAT_BILL_SERVICE_URL_PRODUCCION).toBe(
      'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
    );
  });

  it('acepta explícitamente el modo mock SIRE para desarrollo local', () => {
    const result = validate({
      DATABASE_URL: 'postgres://valid-database',
      API_KEY: 'clave-falsa',
      JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
      SOL_CREDENTIALS_ENCRYPTION_KEY:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      RUC_EMISOR: '20000000001',
      CERT_PASSWORD: '123',
      CERT_BASE64: 'base64',
      SUNAT_SIRE_ENV: 'mock',
    });

    expect(result.SUNAT_SIRE_ENV).toBe('mock');
  });

  it('rechaza valores no soportados para SUNAT_SIRE_ENV', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgres://valid-database',
        API_KEY: 'clave-falsa',
        JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
        SOL_CREDENTIALS_ENCRYPTION_KEY:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        RUC_EMISOR: '20000000001',
        CERT_PASSWORD: '123',
        CERT_BASE64: 'base64',
        SUNAT_SIRE_ENV: 'unknown',
      }),
    ).toThrow(/SUNAT_SIRE_ENV/);
  });

  it('rechaza el modo mock de SIRE en produccion', () => {
    expect(() =>
      validate({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://valid-database',
        API_KEY: 'clave-falsa',
        JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
        SOL_CREDENTIALS_ENCRYPTION_KEY:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        RUC_EMISOR: '20000000001',
        CERT_PASSWORD: '123',
        CERT_BASE64: 'base64',
        SUNAT_SIRE_ENV: 'mock',
      }),
    ).toThrow(/no está permitido/);
  });

  it('mantiene desactivadas por defecto las consultas API SIRE de solo lectura', () => {
    const result = validate({
      DATABASE_URL: 'postgres://valid-database',
      API_KEY: 'clave-falsa',
      JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
      SOL_CREDENTIALS_ENCRYPTION_KEY:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      RUC_EMISOR: '20000000001',
      CERT_PASSWORD: '123',
      CERT_BASE64: 'base64',
    });

    expect(result.SUNAT_SIRE_INTEGRATION_ENABLED).toBe(false);
  });

  it('acepta los hosts oficiales SUNAT para la integración SIRE', () => {
    const result = validate({
      DATABASE_URL: 'postgres://valid-database',
      API_KEY: 'clave-falsa',
      JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
      SOL_CREDENTIALS_ENCRYPTION_KEY:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      RUC_EMISOR: '20000000001',
      CERT_PASSWORD: '123',
      CERT_BASE64: 'base64',
      SUNAT_SIRE_INTEGRATION_ENABLED: 'true',
      SIRE_AUTH_HOST: 'https://api-seguridad.sunat.gob.pe',
      SIRE_API_HOST: 'https://api-sire.sunat.gob.pe',
      SUNAT_CLIENT_ID: 'fake-client-id',
      SUNAT_CLIENT_SECRET: 'fake-client-secret',
    });

    expect(result.SUNAT_SIRE_INTEGRATION_ENABLED).toBe(true);
  });

  it('rechaza un Client ID de ejemplo si se activa la integración SIRE', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgres://valid-database',
        API_KEY: 'clave-falsa',
        JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
        SOL_CREDENTIALS_ENCRYPTION_KEY:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        RUC_EMISOR: '20000000001',
        CERT_PASSWORD: '123',
        CERT_BASE64: 'base64',
        SUNAT_SIRE_INTEGRATION_ENABLED: 'true',
        SIRE_AUTH_HOST: 'https://api-seguridad.sunat.gob.pe',
        SIRE_API_HOST: 'https://api-sire.sunat.gob.pe',
        SUNAT_CLIENT_ID: 'tu-id-sin-espacios',
        SUNAT_CLIENT_SECRET: 'fake-client-secret',
      }),
    ).toThrow(/SUNAT_CLIENT_ID debe contener el Client ID real/);
  });

  it('rechaza cualquier host SIRE diferente del correspondiente oficial', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgres://valid-database',
        API_KEY: 'clave-falsa',
        JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
        SOL_CREDENTIALS_ENCRYPTION_KEY:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        RUC_EMISOR: '20000000001',
        CERT_PASSWORD: '123',
        CERT_BASE64: 'base64',
        SUNAT_SIRE_INTEGRATION_ENABLED: 'true',
        SIRE_AUTH_HOST: 'https://api-seguridad.sunat.gob.pe.evil.test',
        SIRE_API_HOST: 'https://api-sire.sunat.gob.pe',
        SUNAT_CLIENT_ID: 'fake-client-id',
        SUNAT_CLIENT_SECRET: 'fake-client-secret',
      }),
    ).toThrow(/api-seguridad\.sunat\.gob\.pe/);
  });

  it('requiere URLs y credenciales de aplicación si se activa la integración SIRE', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgres://valid-database',
        API_KEY: 'clave-falsa',
        JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
        SOL_CREDENTIALS_ENCRYPTION_KEY:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        RUC_EMISOR: '20000000001',
        CERT_PASSWORD: '123',
        CERT_BASE64: 'base64',
        SUNAT_SIRE_INTEGRATION_ENABLED: 'true',
      }),
    ).toThrow(/SIRE_AUTH_HOST/);
  });

  it('rechaza valores no booleanos para el switch de integración SIRE', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgres://valid-database',
        API_KEY: 'clave-falsa',
        JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
        SOL_CREDENTIALS_ENCRYPTION_KEY:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        RUC_EMISOR: '20000000001',
        CERT_PASSWORD: '123',
        CERT_BASE64: 'base64',
        SUNAT_SIRE_INTEGRATION_ENABLED: 'yes',
      }),
    ).toThrow(/SUNAT_SIRE_INTEGRATION_ENABLED/);
  });

  it('debe rechazar endpoints de Beta que no sean HTTPS', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgres://valid-database',
        API_KEY: 'clave-falsa',
        JWT_SECRET: 'jwt-secreto-seguro-de-prueba',
        SOL_CREDENTIALS_ENCRYPTION_KEY:
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        RUC_EMISOR: '20000000001',
        CERT_PASSWORD: '123',
        CERT_BASE64: 'base64',
        SUNAT_BILL_SERVICE_URL_BETA: 'http://example.com/billService',
      }),
    ).toThrow(/SUNAT_BILL_SERVICE_URL_BETA/);
  });

  it('debe lanzar una excepción detallada si falta JWT_SECRET', () => {
    const mockMissingJwtConfig = {
      PORT: '3000',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://valid-database',
      API_KEY: 'clave-falsa',
      RUC_EMISOR: '20601234567',
      CERT_PASSWORD: '123',
      CERT_BASE64: 'base64',
      // JWT_SECRET ausente
    };

    expect(() => validate(mockMissingJwtConfig)).toThrow(/JWT_SECRET/);
  });
});
