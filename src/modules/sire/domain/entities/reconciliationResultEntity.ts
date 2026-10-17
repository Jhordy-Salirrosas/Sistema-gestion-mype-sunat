import type { DiscrepancyResult } from './sireProposalEntity';

export interface ReconciliationResultEntity {
  companyId: string;
  period: string;
  bookType: 'RVIE' | 'RCE';
  totalLocalRecords: number;
  totalSireRecords: number;
  exactMatchesCount: number;
  discrepanciesCount: number;
  discrepancies: DiscrepancyResult[];
}
