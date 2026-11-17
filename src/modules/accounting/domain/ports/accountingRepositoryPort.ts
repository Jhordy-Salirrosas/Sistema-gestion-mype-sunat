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
  /** Catálogo PCGE global. Por defecto solo las activas. */
  findAccounts(opciones?: { includeInactive?: boolean }): Promise<AccountingAccountEntity[]>;
  createAccount(account: AccountingAccountEntity): Promise<AccountingAccountEntity>;
  /** Cambia el nombre y/o el estado de una cuenta existente. */
  updateAccount(
    code: string,
    cambios: { name?: string; element?: string; isActive?: boolean },
  ): Promise<AccountingAccountEntity>;
  /**
   * Todos los códigos que cuelgan de una cuenta (hijos, nietos, …).
   *
   * La jerarquía se codifica en el propio código (10 → 101 → 1011), así que se
   * resuelve por prefijo sin recorrer la tabla nivel a nivel.
   */
  findDescendantCodes(code: string): Promise<string[]>;
  /** Activa o desactiva varias cuentas de una vez (cascada). */
  setAccountsActive(codes: readonly string[], isActive: boolean): Promise<number>;
  /** Deja constancia de quién inactivó la cuenta. */
  registrarInactivacion(code: string, usuarioId?: string): Promise<void>;
  /** Suma de debe − haber de la cuenta en el período indicado. */
  accountPeriodBalance(companyId: string, code: string, period: string): Promise<number>;
  /** Si la cuenta participa en reglas de contabilización activas. */
  accountUsedInRules(companyId: string, code: string): Promise<number>;
  /** Si la cuenta está configurada como cuenta de tesorería. */
  accountIsTreasury(companyId: string, code: string): Promise<boolean>;
  /** Códigos de cuenta con al menos una línea de asiento en el período. */
  findAccountCodesWithMovements(companyId: string, period: string): Promise<string[]>;
  /** Deja constancia de quién y por qué reabrió un período. */
  registrarReapertura(
    companyId: string,
    period: string,
    datos: { motivo: string; usuarioId?: string },
  ): Promise<void>;
  /** Saldo por cuenta de los asientos del año, para la vista previa del cierre. */
  saldosDeResultado(
    companyId: string,
    year: number,
  ): Promise<Array<{ code: string; name: string; debit: number; credit: number }>>;
  /** Períodos de la empresa, más recientes primero. */
  findPeriods(companyId: string): Promise<AccountingPeriodEntity[]>;
  findPeriod(companyId: string, period: string): Promise<AccountingPeriodEntity | null>;
  openPeriod(companyId: string, year: number, month: number): Promise<AccountingPeriodEntity>;
  openFiscalYear(companyId: string, year: number): Promise<AccountingPeriodEntity[]>;
  closeFiscalYear(companyId: string, year: number): Promise<AccountingPeriodEntity[]>;
  closePeriod(companyId: string, period: string): Promise<AccountingPeriodEntity>;
  /** Cuenta los asientos de un período; se usa antes de eliminar el período. */
  countEntriesByPeriod(companyId: string, period: string): Promise<number>;
  /** Borra el período. Solo debe llamarse cuando no tiene asientos. */
  deletePeriod(companyId: string, period: string): Promise<void>;
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