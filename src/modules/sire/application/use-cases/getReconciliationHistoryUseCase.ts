import { Inject, Injectable } from '@nestjs/common';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../../domain/ports/sireRepositoryPort';
import type { SireHistoryQueryDto } from '../dto/sireHistoryQueryDto';

@Injectable()
export class GetReconciliationHistoryUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT)
    private readonly repository: ISireRepositoryPort,
  ) {}

  async execute(query: SireHistoryQueryDto, companyId: string) {
    const { total, items } =
      await this.repository.getClosedReconciliationHistory(
        companyId,
        (query.page - 1) * query.limit,
        query.limit,
      );
    return {
      page: query.page,
      limit: query.limit,
      total,
      items: items.map((item) => {
        const totals = {
          COINCIDENCIA_EXACTA: 0,
          DIFERENCIA_MONTOS: 0,
          OMISION_LOCAL: 0,
          OMISION_SUNAT: 0,
          DUPLICADO_LLAVE: 0,
        };
        for (const discrepancy of item.discrepancies) {
          if (discrepancy.discrepancyType in totals) {
            totals[discrepancy.discrepancyType]++;
          }
        }
        const denominator = Math.max(
          item.totalLocalRecords,
          item.totalSireRecords,
          1,
        );
        return {
          id: item.id,
          period: item.period,
          bookType: item.bookType,
          status: item.status,
          createdAt: item.createdAt,
          complianceRate:
            Math.round((item.exactMatchesCount / denominator) * 10000) / 100,
          totalsByScenario: totals,
        };
      }),
    };
  }
}
