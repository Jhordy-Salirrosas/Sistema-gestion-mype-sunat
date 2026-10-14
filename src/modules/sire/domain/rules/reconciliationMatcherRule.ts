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

  public static reconcile(
    localRecords: SireRecord[],
    sireRecords: SireRecord[],
  ): ReconciliationSummary {
    const makeKey = (r: SireRecord) =>
      `${r.emitterRuc}|${r.documentType}|${r.series}|${r.correlative}`.toUpperCase();

    const localMap = new Map<string, SireRecord>();
    for (const rec of localRecords) {
      localMap.set(makeKey(rec), rec);
    }

    const sireMap = new Map<string, SireRecord>();
    for (const rec of sireRecords) {
      sireMap.set(makeKey(rec), rec);
    }

    const details: DiscrepancyResult[] = [];
    let exactMatchesCount = 0;
    let discrepanciesCount = 0;

    // 1. Iterar registros locales
    for (const [key, local] of localMap.entries()) {
      const sire = sireMap.get(key);
      if (!sire) {
        // Escenario 4: OMISION_SUNAT
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
        const diffBase = Math.abs(local.taxableBase - sire.taxableBase);
        const diffIgv = Math.abs(local.igvAmount - sire.igvAmount);
        const diffTotal = Math.round(Math.abs(local.totalAmount - sire.totalAmount) * 100) / 100;

        if (diffBase <= this.TOLERANCE && diffIgv <= this.TOLERANCE) {
          // Escenario 1: COINCIDENCIA_EXACTA
          exactMatchesCount++;
          details.push({
            discrepancyType: 'COINCIDENCIA_EXACTA',
            emitterRuc: local.emitterRuc,
            documentType: local.documentType,
            series: local.series,
            correlative: local.correlative,
            localTotalAmount: local.totalAmount,
            sireTotalAmount: sire.totalAmount,
            amountDifference: diffTotal,
          });
        } else {
          // Escenario 2: DIFERENCIA_MONTOS
          discrepanciesCount++;
          details.push({
            discrepancyType: 'DIFERENCIA_MONTOS',
            emitterRuc: local.emitterRuc,
            documentType: local.documentType,
            series: local.series,
            correlative: local.correlative,
            localTotalAmount: local.totalAmount,
            sireTotalAmount: sire.totalAmount,
            amountDifference: diffTotal,
          });
        }
      }
    }

    // 2. Iterar propuestas SIRE para encontrar omisiones locales
    for (const [key, sire] of sireMap.entries()) {
      if (!localMap.has(key)) {
        // Escenario 3: OMISION_LOCAL
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
