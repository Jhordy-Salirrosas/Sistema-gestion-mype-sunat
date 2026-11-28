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
   * Hash scrypt (`salt:clave`) de la contraseña demo del modo offline.
   *
   * Antes era un literal con forma de bcrypt que `NativeCryptoHasherAdapter`
   * no podía verificar —el formato no coincide— y por eso el login tenía un
   * atajo que aceptaba cualquier contraseña para este usuario. Con un hash
   * real del formato correcto, el atajo ya no hace falta: la contraseña demo
   * es `Password123!#`, la misma que anuncia el frontend.
   */
  demoPasswordHash:
    'c8dc7aaa61188c84a9d07b986fbc33b4:668da8ad312b717459b6973d7e6343fa230b00fbf6a3ce77990cd2bf9e71d493e80a294bdb7e9b251c80c238beb8d0883f0f7168d2c101fbeda71bee33823431',
  refreshTokenId: 'mock-refresh-token-id',
} as const;
