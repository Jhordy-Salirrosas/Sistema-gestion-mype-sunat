import { AccountingEntryEntity } from '../entities/accountingEntryEntity';
import type { AccountingAccountEntity } from '../entities/accountingAccountEntity';
import type { AccountingPeriodEntity } from '../entities/accountingPeriodEntity';
import type { LedgerMovement, TrialBalanceRow } from '../entities/accountingReportEntity';

export interface IAccountingRepositoryPort {
  saveEntry(entry: AccountingEntryEntity): Promise<AccountingEntryEntity>;
  findEntriesByPeriod(companyId: string, period: string): Promise<AccountingEntryEntity[]>;
  findByIdempotencyKey(companyId: string, key: string): Promise<AccountingEntryEntity | null>;
  getNextEntryNumber(companyId: string, period: string): Promise<number>;
  /** Evita duplicar el asiento de una misma factura si el job se reprocesa. */
  existsBySourceReference(
    companyId: string,
    sourceModule: string,
    sourceReferenceId: string,
  ): Promise<boolean>;
  /** Catálogo PCGE global. */
  findAccounts(): Promise<AccountingAccountEntity[]>;
  createAccount(account: AccountingAccountEntity): Promise<AccountingAccountEntity>;
  /** Períodos de la empresa, más recientes primero. */
  findPeriods(companyId: string): Promise<AccountingPeriodEntity[]>;
  findPeriod(companyId: string, period: string): Promise<AccountingPeriodEntity | null>;
  openPeriod(companyId: string, year: number, month: number): Promise<AccountingPeriodEntity>;
  openFiscalYear(companyId: string, year: number): Promise<AccountingPeriodEntity[]>;
  closeFiscalYear(companyId: string, year: number): Promise<AccountingPeriodEntity[]>;
  closePeriod(companyId: string, period: string): Promise<AccountingPeriodEntity>;
  /** Movimientos de una cuenta en un período. */
  findLedgerMovements(companyId: string, period: string, accountCode: string): Promise<LedgerMovement[]>;
  /** Saldo acumulado de la cuenta en períodos anteriores. */
  findLedgerOpeningBalance(companyId: string, period: string, accountCode: string): Promise<number>;
  /**
   * Movimientos de varias cuentas a la vez, para el mayor de una cuenta de
   * mayor con subcuentas. Opcional: los dobles de prueba antiguos no lo tienen.
   */
  findLedgerMovementsByAccounts?(
    companyId: string,
    period: string,
    accountCodes: readonly string[],
  ): Promise<LedgerMovement[]>;
  /** Saldo de apertura sumando varias cuentas. */
  findLedgerOpeningBalanceByAccounts?(
    companyId: string,
    period: string,
    accountCodes: readonly string[],
  ): Promise<number>;
  /** Saldos por cuenta de todo el período. */
  findTrialBalanceRows(companyId: string, period: string): Promise<TrialBalanceRow[]>;
}

// Token de inyección de dependencias para NestJS
export const ACCOUNTING_REPOSITORY_PORT = 'ACCOUNTING_REPOSITORY_PORT';