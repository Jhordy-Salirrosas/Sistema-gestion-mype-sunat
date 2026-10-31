import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { ReconciliationResultEntity } from '../../domain/entities/reconciliationResultEntity';
import type { SireProposalEntity } from '../../domain/entities/sireProposalEntity';
import type { ISireRepositoryPort } from '../../domain/ports/sireRepositoryPort';
import {
  closeSireFiscalPeriod,
  findSireReconciliationForExport,
  getSireClosedHistory,
} from './sireReconciliationQueries';
import { persistSireReconciliation } from './sireReconciliationWriter';

@Injectable()
export class PrismaSireRepository implements ISireRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async hasReportUploadHash(
    companyId: string,
    fileHash: string,
  ): Promise<boolean> {
    const upload = await this.prisma.sireReportUpload.findUnique({
      where: { company_id_file_hash: { company_id: companyId, file_hash: fileHash } },
      select: { id: true },
    });
    return Boolean(upload);
  }

  async saveReportUpload(input: {
    companyId: string;
    period: string;
    bookType: 'RVIE' | 'RCE';
    fileName: string;
    fileHash: string;
    proposals: SireProposalEntity[];
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const upload = await tx.sireReportUpload.create({
        data: {
          company_id: input.companyId,
          period: input.period,
          book_type: input.bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS',
          archivo_origen: input.fileName,
          tipo_reporte: input.bookType,
          file_hash: input.fileHash,
        },
      });
      await tx.sireProposal.createMany({
        data: input.proposals.map((proposal) => ({
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
          source_upload_id: upload.id,
        })),
      });
    }, { isolationLevel: 'Serializable' });
  }

  async saveBatchProposals(proposals: SireProposalEntity[]): Promise<void> {
    if (proposals.length === 0) return;
    const first = proposals[0];
    if (
      proposals.some(
        (proposal) =>
          proposal.companyId !== first.companyId ||
          proposal.period !== first.period ||
          proposal.bookType !== first.bookType,
      )
    ) {
      throw new Error(
        'La importación debe pertenecer a una empresa, periodo y libro.',
      );
    }
    await this.prisma.$transaction(
      async (tx) => {
        const closed = await tx.sireReconciliation.findFirst({
          where: {
            company_id: first.companyId,
            period: first.period,
            book_type:
              first.bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS',
            status: 'CERRADO',
          },
          select: { id: true },
        });
        if (closed)
          throw new ConflictException('El periodo fiscal está cerrado.');
        await tx.sireProposal.createMany({
          data: proposals.map((proposal) => ({
            company_id: proposal.companyId,
            period: proposal.period,
            book_type:
              proposal.bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS',
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
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async ensurePeriodOpen(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<void> {
    const closed = await this.prisma.sireReconciliation.findFirst({
      where: {
        company_id: companyId,
        period,
        book_type: bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS',
        status: 'CERRADO',
      },
      select: { id: true },
    });
    if (closed) throw new ConflictException('El periodo fiscal está cerrado.');
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
    await persistSireReconciliation(this.prisma, result);
  }

  async findReconciliationForExport(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ) {
    return findSireReconciliationForExport(
      this.prisma,
      companyId,
      period,
      bookType,
    );
  }

  async getClosedReconciliationHistory(
    companyId: string,
    skip: number,
    take: number,
  ) {
    return getSireClosedHistory(this.prisma, companyId, skip, take);
  }

  async closeFiscalPeriod(
    companyId: string,
    period: string,
    bookType: 'RVIE' | 'RCE',
  ): Promise<void> {
    await closeSireFiscalPeriod(this.prisma, companyId, period, bookType);
  }
}
