export type AccountingPeriodStatus = 'ABIERTO' | 'CERRADO';

export interface AccountingPeriodEntity {
  companyId: string;
  period: string; // YYYY-MM
  year: number;
  month: number;
  status: AccountingPeriodStatus;
  openedAt: Date;
  closedAt?: Date | null;
}
