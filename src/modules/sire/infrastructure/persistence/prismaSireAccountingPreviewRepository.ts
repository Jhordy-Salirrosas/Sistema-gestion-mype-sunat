import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type {
  ISireAccountingPreviewRepositoryPort,
  SireAccountingBookTotals,
} from '../../domain/ports/sireAccountingPreviewRepositoryPort';
import { roundSireAmount } from '../../domain/rules/sireAccountingMappingRule';

interface SireProposalAmountRow {
  book_type: string;
  taxable_base: unknown;
  igv_amount: unknown;
  total_amount: unknown;
}

/**
 * Lectura de los importes reales de las propuestas SIRE para la
 * previsualización de asientos.
 */
@Injectable()
export class PrismaSireAccountingPreviewRepository
  implements ISireAccountingPreviewRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findPeriodTotals(
    companyId: string,
    period: string,
  ): Promise<SireAccountingBookTotals[]> {
    const rows = (await this.prisma.sireProposal.findMany({
      where: {
        company_id: companyId,
        period,
        excluded_at: null,
      },
      select: {
        book_type: true,
        taxable_base: true,
        igv_amount: true,
        total_amount: true,
      },
    })) as SireProposalAmountRow[];

    const grouped = new Map<string, SireAccountingBookTotals>();
    for (const row of rows) {
      const current = grouped.get(row.book_type) ?? {
        bookType: row.book_type as SireAccountingBookTotals['bookType'],
        taxableBase: 0,
        igvAmount: 0,
        totalAmount: 0,
        comprobantes: 0,
      };
      current.taxableBase = roundSireAmount(
        current.taxableBase + Number(row.taxable_base),
      );
      current.igvAmount = roundSireAmount(
        current.igvAmount + Number(row.igv_amount),
      );
      current.totalAmount = roundSireAmount(
        current.totalAmount + Number(row.total_amount),
      );
      current.comprobantes += 1;
      grouped.set(row.book_type, current);
    }

    return [...grouped.values()];
  }
}
