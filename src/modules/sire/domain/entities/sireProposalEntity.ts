export interface SireRecord {
  emitterRuc: string;
  documentType: string;
  series: string;
  correlative: string;
  taxableBase: number;
  igvAmount: number;
  totalAmount: number;
}

export interface SireProposalEntity extends SireRecord {
  companyId: string;
  period: string;
  bookType: 'RVIE' | 'RCE';
  carSunat: string;
  issueDate: Date;
  origin?: 'SUNAT' | 'USUARIO';
}

export type DiscrepancyType =
  | 'COINCIDENCIA_EXACTA'
  | 'DIFERENCIA_MONTOS'
  | 'OMISION_LOCAL'
  | 'OMISION_SUNAT'
  | 'DUPLICADO_LLAVE';

export interface DiscrepancyResult {
  discrepancyType: DiscrepancyType;
  emitterRuc: string;
  documentType: string;
  series: string;
  correlative: string;
  localTotalAmount?: number;
  sireTotalAmount?: number;
  amountDifference: number;
  taxableBaseDifference?: number;
  igvDifference?: number;
  deviationPercentage?: number;
  duplicateSource?: 'LOCAL' | 'SIRE' | 'AMBOS';
  /**
   * CAR de recaudación de 27 dígitos, cuando el comprobante se cobró por una
   * entidad recaudadora (HU-12 / TA-69). Vacío si no aplica: las facturas no
   * llevan CAR y las boletas solo cuando hay depósito por recaudador.
   */
  carSunat?: string;
}
