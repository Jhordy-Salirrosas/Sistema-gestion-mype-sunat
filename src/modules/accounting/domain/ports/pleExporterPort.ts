import { AccountingEntryEntity } from '../entities/accountingEntryEntity';

export interface ExportPleOptions {
  companyRuc: string;
  year: number;
  month: number;
  bookCode: string;
}

export interface IPleExporterPort {
  generatePleTxt(entries: AccountingEntryEntity[], options: ExportPleOptions): Promise<{
    fileName: string;
    content: string;
    recordCount: number;
  }>;
}
