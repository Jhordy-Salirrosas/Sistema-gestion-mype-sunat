import { Injectable } from '@nestjs/common';
import { ReconcilePeriodDto } from '../dto/reconcilePeriodDto';
import type { ReconcileResultDto } from '../dto/reconcileResultDto';
import { ReconciliationMatcherRule } from '../../domain/rules/reconciliationMatcherRule';

@Injectable()
export class ReconcileSireUseCase {
  async execute(dto: ReconcilePeriodDto): Promise<ReconcileResultDto> {
    const summary = ReconciliationMatcherRule.reconcile(
      dto.localRecords,
      dto.sireRecords,
    );

    const maxRecords = Math.max(summary.totalLocal, summary.totalSire, 1);
    const complianceRate =
      Math.round((summary.exactMatchesCount / maxRecords) * 10000) / 100;

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
