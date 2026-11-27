/**
 * Datos de reserva del modo offline del repositorio de usuarios.
 *
 * NO son datos de negocio ni credenciales reales. Existen para que la
 * aplicación pueda arrancar y permitir el login cuando no hay base de datos,
 * y solo se alcanzan cuando `NODE_ENV` no es producción (lo verifica
 * `PrismaUserRepositoryAdapter.isProduction()`).
 *
 * Están aquí, aislados del flujo normal, para que el código de producción no
 * contenga literales de negocio ni credenciales embebidas: si mañana se
 * decide eliminar el modo offline, basta con borrar este archivo y sus usos.
 */
export const OFFLINE_FALLBACK = {
  user: {
    id: 'mock-admin-id',
    email: 'contador@mype.pe',
    fullName: 'Usuario Demo (Modo Offline)',
    role: 'ADMIN',
  },
  company: {
    id: 'mock-company-id',
    ruc: '20601012341',
    legalName: 'MYPE CONFECCIONES INDUSTRIALES S.A.C.',
    tradeName: 'MYPE CONFECCIONES',
  },
  /**
   * Hash de la contraseña demo del modo offline. No es una credencial real:
   * ninguna empresa lo usa, y en producción el flujo ni siquiera lo alcanza.
   */
  demoPasswordHash: '$2a$10$e8R1yYI2e/hF0p.3rR1m0e.8s9Z9v9W9x9y9z9a9b9c9d9e9f',
  refreshTokenId: 'mock-refresh-token-id',
} as const;
