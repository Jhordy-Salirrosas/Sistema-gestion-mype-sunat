import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import type { ReconciliationResultEntity } from '../../domain/entities/reconciliationResultEntity';

export async function persistSireReconciliation(
  prisma: PrismaService,
  result: ReconciliationResultEntity,
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const closed = await tx.sireReconciliation.findFirst({
        where: {
          company_id: result.companyId,
          period: result.period,
          book_type: result.bookType === 'RVIE' ? 'RVIE_VENTAS' : 'RCE_COMPRAS',
          status: 'CERRADO',
        },
        select: { id: true },
      });
      if (closed)
        throw new ConflictException('El periodo fiscal está cerrado.');
      await tx.sireReconciliation.create({
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
              emitter_ruc: item.emitterRuc,
              document_type: item.documentType,
              series: item.series,
              correlative: item.correlative,
              sire_total_amount: item.sireTotalAmount,
              local_total_amount: item.localTotalAmount,
              amount_difference: item.amountDifference,
              taxable_base_difference: item.taxableBaseDifference,
              igv_difference: item.igvDifference,
              duplicate_source: item.duplicateSource,
            })),
          },
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
}
