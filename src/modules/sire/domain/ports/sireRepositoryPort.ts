import type { ReconciliationResultEntity } from '../entities/reconciliationResultEntity';
import type { SireProposalEntity } from '../entities/sireProposalEntity';

export const SIRE_REPOSITORY_PORT = Symbol('SIRE_REPOSITORY_PORT');

export interface ISireRepositoryPort {
  saveBatchProposals(proposals: SireProposalEntity[]): Promise<void>;
  findProposalsByPeriod(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<SireProposalEntity[]>;
  saveReconciliationResult(result: ReconciliationResultEntity): Promise<void>;
}
