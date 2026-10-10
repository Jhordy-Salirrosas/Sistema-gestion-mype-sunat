import 'reflect-metadata';
import { validate } from './env.validation';

describe('Validación de Variables de Entorno (TT-10)', () => {
    it('debe lanzar una excepción detallada si falta DATABASE_URL', () => {
        // Creamos un entorno simulado (mock) al que le borramos deliberadamente DATABASE_URL
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

        // Usamos Jest para confirmar que nuestra función detecta el vacío y "explota" con el error correcto
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
        };

        const result = validate(mockValidConfig);
        expect(result).toBeDefined();
        expect(result.DATABASE_URL).toBe('postgres://valid-database');
    });
});
