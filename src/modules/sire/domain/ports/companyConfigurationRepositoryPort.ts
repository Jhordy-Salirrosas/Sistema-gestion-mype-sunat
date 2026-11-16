/**
 * Variables globales de la empresa consumidas por los reportes SIRE.
 */
export const COMPANY_CONFIGURATION_REPOSITORY_PORT = Symbol(
  'COMPANY_CONFIGURATION_REPOSITORY_PORT',
);

/**
 * Datos de la empresa que se devuelven en la configuración.
 *
 * `businessName` es `null` cuando la empresa todavía no personalizó el nombre;
 * `series` es una lista vacía cuando no hay series configuradas.
 */
export interface CompanyConfigurationData {
  ruc: string;
  businessName: string | null;
  direccion: string | null;
  estado: string | null;
  condicion: string | null;
  ubigeo: string | null;
  esAgenteRetencion: boolean | null;
  series: string[];
}

/**
 * Cambios admitidos por la configuración.
 *
 * Un campo ausente (`undefined`) conserva el valor actual; por eso el
 * repositorio distingue entre "no enviado" y "enviado".
 */
export interface CompanyConfigurationChanges {
  businessName?: string;
  direccion?: string;
  estado?: string;
  condicion?: string;
  ubigeo?: string;
  esAgenteRetencion?: boolean;
  series?: string[];
}

export interface ICompanyConfigurationRepositoryPort {
  /**
   * Devuelve la configuración de la empresa, o `null` si la empresa no existe.
   */
  findByCompanyId(companyId: string): Promise<CompanyConfigurationData | null>;

  /**
   * Actualiza (o crea) la configuración de la empresa. Devuelve `null` si la
   * empresa no existe.
   */
  update(
    companyId: string,
    changes: CompanyConfigurationChanges,
  ): Promise<CompanyConfigurationData | null>;
}
