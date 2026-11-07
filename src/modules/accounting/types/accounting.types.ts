export interface AccountingMovement {
  cuentaContable: string; // Ej: 1212, 40111, 70121
  denominacion: string;
  debe: number;
  haber: number;
}

export interface AccountingEntry {
  id: string;
  numeroAsiento: string;
  fechaContable: string;
  glosa: string;
  totalDebe: number;
  totalHaber: number;
  estaCuadrado: boolean;
  movimientos: AccountingMovement[];
}

export interface AccountingAccount {
  code: string;
  name: string;
  element: string;
  nature: 'Deudora' | 'Acreedora';
  parentCode: string | null;
  level: number;
  isActive: boolean;
}

export interface AccountingPeriod {
  companyId: string;
  period: string; // YYYY-MM
  year: number;
  month: number;
  status: 'ABIERTO' | 'CERRADO';
  openedAt: string;
  closedAt?: string | null;
}

export interface AccountingLineInput {
  lineOrder: number;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
}

export interface CreateAccountingEntryInput {
  period: string;
  entryDate: string;
  glosa: string;
  sourceModule: string;
  /** Clave estable para que el reintento no duplique el asiento. */
  idempotencyKey?: string;
  lines: AccountingLineInput[];
}

export interface LedgerMovement {
  entryId: string;
  entryNumber: number;
  entryDate: string;
  glosa: string;
  sourceModule: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  saldo: number;
}

export interface LedgerResponse {
  period: string;
  accountCode: string;
  accountName: string;
  nature: string;
  openingBalance: number;
  movements: LedgerMovement[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceResponse {
  period: string;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

export interface IncomeStatementLine {
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface IncomeStatementGroup {
  key: 'ingresos' | 'costoVentas' | 'gastosOperativos';
  label: string;
  lines: IncomeStatementLine[];
  total: number;
}

export interface IncomeStatementResponse {
  period: string;
  groups: IncomeStatementGroup[];
  ingresos: number;
  costoVentas: number;
  gastosOperativos: number;
  resultadoBruto: number;
  resultadoOperativo: number;
}

export interface BalanceSheetGroup {
  key: 'activo' | 'pasivo' | 'patrimonio';
  label: string;
  lines: BalanceSheetLine[];
  total: number;
}

export interface BalanceSheetResponse {
  period: string;
  activo: BalanceSheetGroup;
  pasivo: BalanceSheetGroup;
  patrimonio: BalanceSheetGroup;
  resultadoEjercicio: number;
  totalActivo: number;
  totalPatrimonio: number;
  totalPasivoPatrimonio: number;
  cuadra: boolean;
}

export interface PleExportConfig {
  periodo: string; // AAAAMM
  libro: '5.1_DIARIO' | '6.1_MAYOR' | '8.1_COMPRAS' | '14.1_VENTAS';
  indicadorContenido: '1_CON_INFORMACION' | '0_CIERRE_OPERACIONES';
}
