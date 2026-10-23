import type { DiscrepancyResult } from '../../domain/entities/sireProposalEntity';
import type { ReconciliationHistoryRecord } from '../../domain/ports/sireRepositoryPort';
import type {
  DiscrepancyType,
  SireDuplicateSource,
} from '../../../../generated/client/enums';

type PrismaDiscrepancy = {
  discrepancy_type: DiscrepancyType;
  emitter_ruc: string | null;
  document_type: string;
  series: string;
  correlative: string;
  sire_total_amount: { toNumber(): number } | null;
  local_total_amount: { toNumber(): number } | null;
  amount_difference: { toNumber(): number } | null;
  taxable_base_difference: { toNumber(): number } | null;
  igv_difference: { toNumber(): number } | null;
  duplicate_source: SireDuplicateSource | null;
};

export function mapDiscrepancy(item: PrismaDiscrepancy): DiscrepancyResult {
  return {
    discrepancyType: item.discrepancy_type,
    emitterRuc: item.emitter_ruc ?? '',
    documentType: item.document_type,
    series: item.series,
    correlative: item.correlative,
    sireTotalAmount: item.sire_total_amount?.toNumber(),
    localTotalAmount: item.local_total_amount?.toNumber(),
    amountDifference: item.amount_difference?.toNumber() ?? 0,
    taxableBaseDifference: item.taxable_base_difference?.toNumber(),
    igvDifference: item.igv_difference?.toNumber(),
    duplicateSource: item.duplicate_source ?? undefined,
  };
}

export function mapHistoryRecord(record: {
  id: string;
  period: string;
  book_type: 'RVIE_VENTAS' | 'RCE_COMPRAS';
  status: 'EN_REVISION' | 'CONCILIADO' | 'CERRADO';
  total_local_records: number;
  total_sunat_records: number;
  exact_matches_count: number;
  created_at: Date;
  discrepancies: PrismaDiscrepancy[];
}): ReconciliationHistoryRecord {
  return {
    id: record.id,
    period: record.period,
    bookType: record.book_type === 'RVIE_VENTAS' ? 'RVIE' : 'RCE',
    status: record.status,
    totalLocalRecords: record.total_local_records,
    totalSireRecords: record.total_sunat_records,
    exactMatchesCount: record.exact_matches_count,
    createdAt: record.created_at,
    discrepancies: record.discrepancies.map(mapDiscrepancy),
  };
}
