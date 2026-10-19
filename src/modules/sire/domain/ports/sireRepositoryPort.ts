import type { ReconciliationResultEntity } from '../entities/reconciliationResultEntity';
import type { SireProposalEntity } from '../entities/sireProposalEntity';

export const SIRE_REPOSITORY_PORT = Symbol('SIRE_REPOSITORY_PORT');

export interface ReconciliationHistoryRecord {
  id: string;
  period: string;
  bookType: 'RVIE' | 'RCE';
  status: 'EN_REVISION' | 'CONCILIADO' | 'CERRADO';
  totalLocalRecords: number;
  totalSireRecords: number;
  exactMatchesCount: number;
  createdAt: Date;
  discrepancies: ReconciliationResultEntity['discrepancies'];
}

export interface ISireRepositoryPort {
  saveBatchProposals(proposals: SireProposalEntity[]): Promise<void>;
  ensurePeriodOpen(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<void>;
  findProposalsByPeriod(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<SireProposalEntity[]>;
  findReconciliationForExport(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<ReconciliationHistoryRecord | null>;
  getClosedReconciliationHistory(
    companyId: string,
    skip: number,
    take: number,
  ): Promise<{ total: number; items: ReconciliationHistoryRecord[] }>;
  closeFiscalPeriod(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<void>;
  saveReconciliationResult(result: ReconciliationResultEntity): Promise<void>;
}
