export interface LedgerMovement {
  entryId: string;
  entryNumber: number;
  entryDate: Date;
  glosa: string;
  sourceModule: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}
