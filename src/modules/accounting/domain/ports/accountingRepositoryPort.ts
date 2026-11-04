import { AccountingEntryEntity } from '../entities/accountingEntryEntity';
import type { AccountingAccountEntity } from '../entities/accountingAccountEntity';
import type { AccountingPeriodEntity } from '../entities/accountingPeriodEntity';

export interface IAccountingRepositoryPort {
  saveEntry(entry: AccountingEntryEntity): Promise<AccountingEntryEntity>;
  findEntriesByPeriod(companyId: string, period: string): Promise<AccountingEntryEntity[]>;
  getNextEntryNumber(companyId: string, period: string): Promise<number>;
  /** Evita duplicar el asiento de una misma factura si el job se reprocesa. */
  existsBySourceReference(
    companyId: string,
    sourceModule: string,
    sourceReferenceId: string,
  ): Promise<boolean>;
  /** Catálogo PCGE global. */
  findAccounts(): Promise<AccountingAccountEntity[]>;
  /** Períodos de la empresa, más recientes primero. */
  findPeriods(companyId: string): Promise<AccountingPeriodEntity[]>;
  findPeriod(companyId: string, period: string): Promise<AccountingPeriodEntity | null>;
  openPeriod(companyId: string, year: number, month: number): Promise<AccountingPeriodEntity>;
  closePeriod(companyId: string, period: string): Promise<AccountingPeriodEntity>;
}

// Token de inyección de dependencias para NestJS
export const ACCOUNTING_REPOSITORY_PORT = 'ACCOUNTING_REPOSITORY_PORT';