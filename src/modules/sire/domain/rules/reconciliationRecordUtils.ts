import type {
  DiscrepancyResult,
  SireRecord,
} from '../entities/sireProposalEntity';

export type IndexedRecords = Map<string, SireRecord[]>;

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError('Los importes de conciliación deben ser finitos.');
  }
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function makeKey(record: SireRecord): string {
  return [
    record.emitterRuc,
    record.documentType,
    record.series,
    record.correlative,
  ]
    .map((part) => part.trim().toUpperCase())
    .join('-');
}

export function indexRecords(records: SireRecord[]): IndexedRecords {
  const indexed: IndexedRecords = new Map();
  for (const record of records) {
    const key = makeKey(record);
    const matches = indexed.get(key) ?? [];
    matches.push(record);
    indexed.set(key, matches);
  }
  return indexed;
}

export function createDetail(
  record: SireRecord,
  discrepancyType: DiscrepancyResult['discrepancyType'],
  amounts: Pick<
    DiscrepancyResult,
    | 'localTotalAmount'
    | 'sireTotalAmount'
    | 'amountDifference'
    | 'taxableBaseDifference'
    | 'igvDifference'
    | 'deviationPercentage'
    | 'duplicateSource'
  >,
): DiscrepancyResult {
  return {
    discrepancyType,
    emitterRuc: record.emitterRuc,
    documentType: record.documentType,
    series: record.series,
    correlative: record.correlative,
    ...amounts,
  };
}
