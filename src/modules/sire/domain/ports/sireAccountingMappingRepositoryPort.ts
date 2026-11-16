/**
 * Mapeo contable de los conceptos SIRE a cuentas del PCGE.
 */
export const SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT = Symbol(
  'SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT',
);

/**
 * Un mapeo guardado.
 */
export interface SireAccountingMappingEntry {
  tipoOperacion: string;
  cuentaContable: string;
}

export interface ISireAccountingMappingRepositoryPort {
  /**
   * Devuelve todos los mapeos de la empresa, o `null` si la empresa no existe.
   */
  findAll(
    companyId: string,
  ): Promise<SireAccountingMappingEntry[] | null>;

  /**
   * Guarda (crea o actualiza) el conjunto de mapeos de la empresa.
   *
   * Devuelve los mapeos persistidos, ordenados por tipo de operación, o `null`
   * si la empresa no existe.
   */
  upsertMany(
    companyId: string,
    mappings: SireAccountingMappingEntry[],
  ): Promise<SireAccountingMappingEntry[] | null>;
}
