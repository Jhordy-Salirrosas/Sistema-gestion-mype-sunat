import { Inject, Injectable } from '@nestjs/common';
import { ReconcilePeriodDto } from '../dto/reconcilePeriodDto';
import type { ReconcileResultDto } from '../dto/reconcileResultDto';
import { ReconciliationMatcherRule } from '../../domain/rules/reconciliationMatcherRule';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../../domain/ports/sireRepositoryPort';

@Injectable()
export class ReconcileSireUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT)
    private readonly sireRepository: ISireRepositoryPort,
  ) {}

  async execute(
    dto: ReconcilePeriodDto,
    companyId: string,
  ): Promise<ReconcileResultDto> {
    const repositoryBookType = dto.bookType === 'RVIE_VENTAS' ? 'RVIE' : 'RCE';
    const sireRecords = await this.sireRepository.findProposalsByPeriod(
      companyId,
      dto.period,
      repositoryBookType,
    );
    const summary = ReconciliationMatcherRule.reconcile(
      dto.localRecords,
      sireRecords,
    );

    const maxRecords = Math.max(summary.totalLocal, summary.totalSire, 1);
    const complianceRate =
      Math.round((summary.exactMatchesCount / maxRecords) * 10000) / 100;

    await this.sireRepository.saveReconciliationResult({
      companyId,
      period: dto.period,
      bookType: repositoryBookType,
      totalLocalRecords: summary.totalLocal,
      totalSireRecords: summary.totalSire,
      exactMatchesCount: summary.exactMatchesCount,
      discrepanciesCount: summary.discrepanciesCount,
      discrepancies: summary.details,
    });

    return {
      period: dto.period,
      bookType: dto.bookType,
      totalLocalRecords: summary.totalLocal,
      totalSireRecords: summary.totalSire,
      exactMatchesCount: summary.exactMatchesCount,
      discrepanciesCount: summary.discrepanciesCount,
      complianceRate,
      discrepancies: summary.details,
    };
  }
}
