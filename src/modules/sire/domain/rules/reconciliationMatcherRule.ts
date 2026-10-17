import type {
  DiscrepancyResult,
  SireRecord,
} from '../entities/sireProposalEntity';

export interface ReconciliationSummary {
  totalLocal: number;
  totalSire: number;
  exactMatchesCount: number;
  discrepanciesCount: number;
  details: DiscrepancyResult[];
}

export class ReconciliationMatcherRule {
  private static readonly TOLERANCE = 0.05;

  private static makeKey(record: SireRecord): string {
    return [
      record.emitterRuc,
      record.documentType,
      record.series,
      record.correlative,
    ]
      .map((part) => part.trim().toUpperCase())
      .join('-');
  }

  private static exceedsTolerance(difference: number): boolean {
    return Math.round(Math.abs(difference) * 100) > this.TOLERANCE * 100;
  }

  public static reconcile(
    localRecords: SireRecord[],
    sireRecords: SireRecord[],
  ): ReconciliationSummary {
    const localMap = new Map<string, SireRecord>();
    for (const rec of localRecords) {
      localMap.set(this.makeKey(rec), rec);
    }

    const sireMap = new Map<string, SireRecord>();
    for (const rec of sireRecords) {
      sireMap.set(this.makeKey(rec), rec);
    }

    const details: DiscrepancyResult[] = [];
    let exactMatchesCount = 0;
    let discrepanciesCount = 0;

    for (const [key, local] of localMap.entries()) {
      const sire = sireMap.get(key);
      if (!sire) {
        discrepanciesCount++;
        details.push({
          discrepancyType: 'OMISION_SUNAT',
          emitterRuc: local.emitterRuc,
          documentType: local.documentType,
          series: local.series,
          correlative: local.correlative,
          localTotalAmount: local.totalAmount,
          sireTotalAmount: undefined,
          amountDifference: local.totalAmount,
        });
      } else {
        const baseDifference = local.taxableBase - sire.taxableBase;
        const igvDifference = local.igvAmount - sire.igvAmount;
        const totalDifference =
          Math.round(Math.abs(local.totalAmount - sire.totalAmount) * 100) /
          100;
        const discrepancy = {
          emitterRuc: local.emitterRuc,
          documentType: local.documentType,
          series: local.series,
          correlative: local.correlative,
          localTotalAmount: local.totalAmount,
          sireTotalAmount: sire.totalAmount,
          amountDifference: totalDifference,
          taxableBaseDifference: Math.round(baseDifference * 100) / 100,
          igvDifference: Math.round(igvDifference * 100) / 100,
        };

        if (
          !this.exceedsTolerance(baseDifference) &&
          !this.exceedsTolerance(igvDifference)
        ) {
          exactMatchesCount++;
          details.push({
            discrepancyType: 'COINCIDENCIA_EXACTA',
            ...discrepancy,
          });
        } else {
          discrepanciesCount++;
          details.push({
            discrepancyType: 'DIFERENCIA_MONTOS',
            ...discrepancy,
            deviationPercentage:
              local.totalAmount === 0
                ? 0
                : Math.round(
                    (totalDifference / Math.abs(local.totalAmount)) * 10000,
                  ) / 100,
          });
        }
      }
    }

    for (const [key, sire] of sireMap.entries()) {
      if (!localMap.has(key)) {
        discrepanciesCount++;
        details.push({
          discrepancyType: 'OMISION_LOCAL',
          emitterRuc: sire.emitterRuc,
          documentType: sire.documentType,
          series: sire.series,
          correlative: sire.correlative,
          localTotalAmount: undefined,
          sireTotalAmount: sire.totalAmount,
          amountDifference: sire.totalAmount,
        });
      }
    }

    return {
      totalLocal: localRecords.length,
      totalSire: sireRecords.length,
      exactMatchesCount,
      discrepanciesCount,
      details,
    };
  }
}
