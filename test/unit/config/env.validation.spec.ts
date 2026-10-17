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
        };

        const result = validate(mockValidConfig);
        expect(result).toBeDefined();
        expect(result.DATABASE_URL).toBe('postgres://valid-database');
        expect(result.JWT_SECRET).toBe('jwt-secreto-seguro-de-prueba');
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
