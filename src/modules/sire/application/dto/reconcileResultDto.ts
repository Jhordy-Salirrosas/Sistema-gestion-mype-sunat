import type { DiscrepancyResult } from '../../domain/entities/sireProposalEntity';

export interface ReconcileResultDto {
  period: string;
  bookType: string;
  totalLocalRecords: number;
  totalSireRecords: number;
  exactMatchesCount: number;
  discrepanciesCount: number;
  complianceRate: number; // Porcentaje de concordancia (0 a 100)
  discrepancies: DiscrepancyResult[];
}
