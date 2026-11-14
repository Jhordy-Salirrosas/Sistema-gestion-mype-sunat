/**
 * Credenciales de la empresa para la integración con SUNAT/SIRE.
 *
 * El repositorio guarda SIEMPRE texto cifrado: el caso de uso entrega
 * texto plano y el adaptador lo cifra con `SOL_CREDENTIAL_CIPHER` (AES-256-GCM)
 * antes de tocar la base de datos.
 */
export const SIRE_CONFIGURATION_REPOSITORY_PORT = Symbol(
  'SIRE_CONFIGURATION_REPOSITORY_PORT',
);

/**
 * Credenciales de una empresa.
 *
 * `undefined` significa "no informado": el adaptador conserva el valor que
 * ya había. `null` significa "bórralo": el adaptador deja la columna a NULL.
 */
export interface SireConfigurationCredentials {
  clientId?: string | null;
  clientSecret?: string | null;
  solUser?: string | null;
  solPassword?: string | null;
}

/**
 * Credenciales ya descifradas, listas para usarse contra SUNAT.
 *
 * Un campo ausente (`undefined`) significa que la empresa todavía no lo tiene
 * configurado; un campo vacío (`''`) es un valor configurado pero inválido y
 * por eso se distingue del anterior.
 */
export interface SireConfigurationResolved {
  clientId?: string;
  clientSecret?: string;
  solUser?: string;
  solPassword?: string;
}

export interface ISireConfigurationRepositoryPort {
  /**
   * Guarda (o actualiza) las credenciales de la empresa.
   */
  save(
    companyId: string,
    credentials: SireConfigurationCredentials,
  ): Promise<void>;

  /**
   * Devuelve las credenciales descifradas de la empresa, o `null` si la
   * empresa todavía no tiene configuración.
   */
  findByCompanyId(
    companyId: string,
  ): Promise<SireConfigurationResolved | null>;

  /**
   * `true` cuando la empresa tiene las cuatro credenciales necesarias para
   * hablar con la API SIRE de SUNAT.
   */
  isConfigured(companyId: string): Promise<boolean>;
}
