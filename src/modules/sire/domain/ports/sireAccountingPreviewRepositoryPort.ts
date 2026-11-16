import type { SireApiBookType } from '../../application/sireBookType';
import type { SireAccountingTotals } from '../rules/sireAccountingMappingRule';

export const SIRE_ACCOUNTING_PREVIEW_REPOSITORY_PORT = Symbol(
  'SIRE_ACCOUNTING_PREVIEW_REPOSITORY_PORT',
);

/** Totales importados de un libro SIRE en un periodo. */
export interface SireAccountingBookTotals extends SireAccountingTotals {
  bookType: SireApiBookType;
  comprobantes: number;
}

export interface ISireAccountingPreviewRepositoryPort {
  /**
   * Devuelve los totales de las propuestas importadas del periodo, agrupados
   * por libro. Los comprobantes excluidos no se consideran.
   */
  findPeriodTotals(
    companyId: string,
    period: string,
  ): Promise<SireAccountingBookTotals[]>;
}
