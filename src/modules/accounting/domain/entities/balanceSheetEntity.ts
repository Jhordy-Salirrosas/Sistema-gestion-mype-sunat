export interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface BalanceSheetGroup {
  key: 'activo' | 'pasivo' | 'patrimonio';
  label: string;
  lines: BalanceSheetLine[];
  total: number;
}
