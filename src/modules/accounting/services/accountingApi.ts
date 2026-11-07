import { apiClient } from '@/lib/axios';
import { cachedGet } from '@/lib/offlineCache';
import {
  type AccountingAccount,
  type AccountingEntry,
  type AccountingPeriod,
  type CreateAccountingEntryInput,
  type LedgerResponse,
  type TrialBalanceResponse,
  type IncomeStatementResponse,
  type BalanceSheetResponse,
  type PleExportConfig,
} from '../types/accounting.types';

export const accountingApi = {
  getEntries: async (period?: string): Promise<AccountingEntry[]> => {
    return cachedGet(`accounting-entries:${period ?? 'actual'}`, async () => {
      const response = await apiClient.get<AccountingEntry[]>('/accounting/entries', {
        params: { period },
      });
      return response.data;
    });
  },

  createEntry: async (entry: CreateAccountingEntryInput): Promise<AccountingEntry> => {
    const response = await apiClient.post<AccountingEntry>('/accounting/entries', entry);
    return response.data;
  },

  getAccounts: async (): Promise<AccountingAccount[]> => {
    return cachedGet('accounting-accounts', async () => {
      const response = await apiClient.get<AccountingAccount[]>('/accounting/accounts');
      return response.data;
    });
  },

  getPeriods: async (): Promise<AccountingPeriod[]> => {
    return cachedGet('accounting-periods', async () => {
      const response = await apiClient.get<AccountingPeriod[]>('/accounting/periods');
      return response.data;
    });
  },

  openPeriod: async (year: number, month: number): Promise<AccountingPeriod> => {
    const response = await apiClient.post<AccountingPeriod>('/accounting/periods', { year, month });
    return response.data;
  },

  closePeriod: async (period: string): Promise<AccountingPeriod> => {
    const response = await apiClient.post<AccountingPeriod>(`/accounting/periods/${period}/close`);
    return response.data;
  },

  getLedger: async (period: string, accountCode: string): Promise<LedgerResponse> => {
    return cachedGet(`accounting-ledger:${period}:${accountCode}`, async () => {
      const response = await apiClient.get<LedgerResponse>('/accounting/ledger', {
        params: { period, accountCode },
      });
      return response.data;
    });
  },

  getTrialBalance: async (period: string): Promise<TrialBalanceResponse> => {
    return cachedGet(`accounting-trial-balance:${period}`, async () => {
      const response = await apiClient.get<TrialBalanceResponse>('/accounting/trial-balance', {
        params: { period },
      });
      return response.data;
    });
  },

  getIncomeStatement: async (period: string): Promise<IncomeStatementResponse> => {
    return cachedGet(`accounting-income-statement:${period}`, async () => {
      const response = await apiClient.get<IncomeStatementResponse>('/accounting/income-statement', {
        params: { period },
      });
      return response.data;
    });
  },

  getBalanceSheet: async (period: string): Promise<BalanceSheetResponse> => {
    return cachedGet(`accounting-balance-sheet:${period}`, async () => {
      const response = await apiClient.get<BalanceSheetResponse>('/accounting/balance-sheet', {
        params: { period },
      });
      return response.data;
    });
  },

  exportPleBook: async (config: PleExportConfig): Promise<Blob> => {
    const response = await apiClient.post('/accounting/ple/export', config, {
      responseType: 'blob',
    });
    return response.data;
  },
};
