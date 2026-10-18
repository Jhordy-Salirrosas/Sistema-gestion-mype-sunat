import type { DiscrepancyResult } from '../entities/sireProposalEntity';

export const SIRE_EXPORTER_PORT = Symbol('SIRE_EXPORTER_PORT');

export interface SireExportInput {
  period: string;
  bookType: 'RVIE' | 'RCE';
  discrepancies: DiscrepancyResult[];
}

export interface SireExportFile {
  fileName: string;
  content: Uint8Array;
}

export interface ISireExporterPort {
  export(input: SireExportInput): SireExportFile;
}
