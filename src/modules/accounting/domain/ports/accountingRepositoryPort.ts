import { AccountingEntryEntity } from '../entities/accountingEntryEntity';

export interface IAccountingRepositoryPort {
  saveEntry(entry: AccountingEntryEntity): Promise<AccountingEntryEntity>;
  findEntriesByPeriod(companyId: string, period: string): Promise<AccountingEntryEntity[]>;
  getNextEntryNumber(companyId: string, period: string): Promise<number>;
}
