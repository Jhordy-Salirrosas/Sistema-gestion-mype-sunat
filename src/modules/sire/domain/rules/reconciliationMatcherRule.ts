import type {
  DiscrepancyResult,
  SireRecord,
} from '../entities/sireProposalEntity';
import {
  createDetail,
  fromCents,
  indexRecords,
  toCents,
} from './reconciliationRecordUtils';

export interface ReconciliationSummary {
  totalLocal: number;
  totalSire: number;
  exactMatchesCount: number;
  discrepanciesCount: number;
  details: DiscrepancyResult[];
}

export class ReconciliationMatcherRule {
  private static readonly TOLERANCE_CENTS = 5;

  public static reconcile(
    localRecords: SireRecord[],
    sireRecords: SireRecord[],
  ): ReconciliationSummary {
    const localIndex = indexRecords(localRecords);
    const sireIndex = indexRecords(sireRecords);
    const keys = new Set([...localIndex.keys(), ...sireIndex.keys()]);
    const details: DiscrepancyResult[] = [];
    let exactMatchesCount = 0;

    for (const key of keys) {
      const localMatches = localIndex.get(key) ?? [];
      const sireMatches = sireIndex.get(key) ?? [];
      if (localMatches.length > 1 || sireMatches.length > 1) {
        details.push(this.createDuplicateDetail(localMatches, sireMatches));
        continue;
      }
      const local = localMatches[0];
      const sire = sireMatches[0];
      if (!local && sire) {
        details.push(
          createDetail(sire, 'OMISION_LOCAL', {
            localTotalAmount: undefined,
            sireTotalAmount: sire.totalAmount,
            amountDifference: sire.totalAmount,
          }),
        );
      } else if (local && !sire) {
        details.push(
          createDetail(local, 'OMISION_SUNAT', {
            localTotalAmount: local.totalAmount,
            sireTotalAmount: undefined,
            amountDifference: local.totalAmount,
          }),
        );
      } else if (local && sire) {
        const detail = this.compareAmounts(local, sire);
        details.push(detail);
        if (detail.discrepancyType === 'COINCIDENCIA_EXACTA') {
          exactMatchesCount++;
        }
      }
    }

    return {
      totalLocal: localRecords.length,
      totalSire: sireRecords.length,
      exactMatchesCount,
      discrepanciesCount: details.filter(
        (detail) => detail.discrepancyType !== 'COINCIDENCIA_EXACTA',
      ).length,
      details,
    };
  }

  private static createDuplicateDetail(
    localMatches: SireRecord[],
    sireMatches: SireRecord[],
  ): DiscrepancyResult {
    const duplicateSource =
      localMatches.length > 1 && sireMatches.length > 1
        ? 'AMBOS'
        : localMatches.length > 1
          ? 'LOCAL'
          : 'SIRE';
    const record = localMatches[0] ?? sireMatches[0];
    return createDetail(record, 'DUPLICADO_LLAVE', {
      localTotalAmount:
        localMatches.length === 1 ? localMatches[0].totalAmount : undefined,
      sireTotalAmount:
        sireMatches.length === 1 ? sireMatches[0].totalAmount : undefined,
      amountDifference: 0,
      duplicateSource,
    });
  }

  private static compareAmounts(
    local: SireRecord,
    sire: SireRecord,
  ): DiscrepancyResult {
    const baseDifferenceCents =
      toCents(local.taxableBase) - toCents(sire.taxableBase);
    const igvDifferenceCents =
      toCents(local.igvAmount) - toCents(sire.igvAmount);
    const totalDifferenceCents = Math.abs(
      toCents(local.totalAmount) - toCents(sire.totalAmount),
    );
    const isExact =
      Math.abs(baseDifferenceCents) <= this.TOLERANCE_CENTS &&
      Math.abs(igvDifferenceCents) <= this.TOLERANCE_CENTS;
    const discrepancyType = isExact
      ? 'COINCIDENCIA_EXACTA'
      : 'DIFERENCIA_MONTOS';
    return createDetail(local, discrepancyType, {
      localTotalAmount: local.totalAmount,
      sireTotalAmount: sire.totalAmount,
      amountDifference: fromCents(totalDifferenceCents),
      taxableBaseDifference: fromCents(baseDifferenceCents),
      igvDifference: fromCents(igvDifferenceCents),
      ...(isExact
        ? {}
        : {
            deviationPercentage:
              local.totalAmount === 0
                ? 0
                : Math.round(
                    (totalDifferenceCents /
                      Math.abs(toCents(local.totalAmount))) *
                      10_000,
                  ) / 100,
          }),
    });
  }
}
