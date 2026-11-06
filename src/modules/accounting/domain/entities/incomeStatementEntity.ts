export interface IncomeStatementLine {
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
