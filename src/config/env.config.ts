import { z } from 'zod';

/**
 * Esquema de validación estricto para las variables de entorno de la SPA.
 * Garantiza que la aplicación falle tempranamente (Fail-Fast) si falta
 * alguna variable crítica antes de renderizar la UI.
 */
const envSchema = z.object({
  VITE_API_URL: z
    .string()
    .min(1, { message: 'VITE_API_URL no puede estar vacío' })
    .default('/api/v1'),
  VITE_SUNAT_ENV: z
    .enum(['BETA', 'PRODUCCION'], {
      message: 'VITE_SUNAT_ENV debe ser BETA o PRODUCCION',
    })
    .default('BETA'),
  VITE_APP_NAME: z.string().default('SYNC-SUNAT'),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  console.error('❌ [CONFIG ERROR] Variables de entorno inválidas o faltantes:');
  console.error(parsedEnv.error.format());
  throw new Error('Configuración de variables de entorno inválida. Revisa el archivo .env');
}

/**
 * Constante inmutable tipada de variables de entorno disponibles en toda la app.
 */
export const ENV = Object.freeze(parsedEnv.data);

export const API_BASE_URL = ENV.VITE_API_URL.replace(/\/+$/, '').endsWith('/api/v1')
  ? ENV.VITE_API_URL.replace(/\/+$/, '')
  : `${ENV.VITE_API_URL.replace(/\/+$/, '')}/api/v1`;
