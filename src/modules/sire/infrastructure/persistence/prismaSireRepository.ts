import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { ReconciliationResultEntity } from '../../domain/entities/reconciliationResultEntity';
import type { SireProposalEntity } from '../../domain/entities/sireProposalEntity';
import type { ISireRepositoryPort } from '../../domain/ports/sireRepositoryPort';

@Injectable()
export class PrismaSireRepository implements ISireRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async saveBatchProposals(proposals: SireProposalEntity[]): Promise<void> {
    if (proposals.length === 0) return;

    await this.prisma.sireProposal.createMany({
      data: proposals.map((proposal) => ({
        company_id: proposal.companyId,
        period: proposal.period,
        book_type: proposal.bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS',
        car_sunat: proposal.carSunat,
        emitter_ruc: proposal.emitterRuc,
        document_type: proposal.documentType,
        series: proposal.series,
        correlative: proposal.correlative,
        issue_date: proposal.issueDate,
        taxable_base: proposal.taxableBase,
        igv_amount: proposal.igvAmount,
        total_amount: proposal.totalAmount,
      })),
    });
  }

  async findProposalsByPeriod(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<SireProposalEntity[]> {
    const proposals = await this.prisma.sireProposal.findMany({
      where: {
        company_id: companyId,
        period,
        book_type: bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS',
      },
    });

    return proposals.map((proposal) => ({
      companyId: proposal.company_id,
      period: proposal.period,
      bookType,
      carSunat: proposal.car_sunat,
      issueDate: proposal.issue_date,
      emitterRuc: proposal.emitter_ruc,
      documentType: proposal.document_type,
      series: proposal.series,
      correlative: proposal.correlative,
      taxableBase: proposal.taxable_base.toNumber(),
      igvAmount: proposal.igv_amount.toNumber(),
      totalAmount: proposal.total_amount.toNumber(),
    }));
  }

  async saveReconciliationResult(
    result: ReconciliationResultEntity,
  ): Promise<void> {
    await this.prisma.sireReconciliation.create({
      data: {
        company_id: result.companyId,
        period: result.period,
        book_type: result.bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS',
        total_sunat_records: result.totalSireRecords,
        total_local_records: result.totalLocalRecords,
        exact_matches_count: result.exactMatchesCount,
        discrepancies_count: result.discrepanciesCount,
        discrepancies: {
          create: result.discrepancies.map((item) => ({
            discrepancy_type: item.discrepancyType,
            document_type: item.documentType,
            series: item.series,
            correlative: item.correlative,
            sire_total_amount: item.sireTotalAmount,
            local_total_amount: item.localTotalAmount,
            amount_difference: item.amountDifference,
          })),
        },
      },
    });
  }
}
