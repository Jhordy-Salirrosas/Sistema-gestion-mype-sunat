import type { ReconciliationResultEntity } from '../entities/reconciliationResultEntity';
import type { SireProposalEntity } from '../entities/sireProposalEntity';

export const SIRE_REPOSITORY_PORT = Symbol('SIRE_REPOSITORY_PORT');

export interface SireProposalRecord extends SireProposalEntity {
  id: string;
}

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
  upsertPeriod(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<{ id: string; state: string }>;
  getPeriod(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<{
    id: string;
    state: string;
    ticket: string | null;
    ticketOperation: string | null;
  } | null>;
  saveSunatProposal(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
    proposals: SireProposalEntity[],
  ): Promise<void>;
  getProposal(
    companyId: string,
    proposalId: string,
  ): Promise<{
    id: string;
    origin: 'SUNAT' | 'USUARIO';
    periodId: string | null;
    periodState: string | null;
  } | null>;
  excludeSunatProposal(
    companyId: string,
    proposalId: string,
    userId: string,
  ): Promise<void>;
  restoreProposal(
    companyId: string,
    proposalId: string,
  ): Promise<void>;
  getPeriodProposals(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<SireProposalRecord[]>;
  setPeriodTicket(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
    state: string,
    ticket: string,
    operation: string,
  ): Promise<void>;
  setPeriodState(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
    state: string,
    error?: string,
  ): Promise<void>;
  hasReportUploadHash(companyId: string, fileHash: string): Promise<boolean>;
  saveReportUpload(input: {
    companyId: string;
    period: string;
    bookType: 'RVIE' | 'RCE';
    fileName: string;
    fileHash: string;
    proposals: SireProposalEntity[];
  }): Promise<void>;
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
