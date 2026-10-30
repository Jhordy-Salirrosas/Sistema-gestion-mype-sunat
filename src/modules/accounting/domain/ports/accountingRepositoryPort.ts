import { AccountingEntryEntity } from '../entities/accountingEntryEntity';

export interface IAccountingRepositoryPort {
  saveEntry(entry: AccountingEntryEntity): Promise<AccountingEntryEntity>;
  findEntriesByPeriod(companyId: string, period: string): Promise<AccountingEntryEntity[]>;
  getNextEntryNumber(companyId: string, period: string): Promise<number>;
}

// Token de inyección de dependencias para NestJS
export const ACCOUNTING_REPOSITORY_PORT = 'ACCOUNTING_REPOSITORY_PORT';