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
}

export type DiscrepancyType =
  | 'COINCIDENCIA_EXACTA'
  | 'DIFERENCIA_MONTOS'
  | 'OMISION_LOCAL'
  | 'OMISION_SUNAT';

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
}
