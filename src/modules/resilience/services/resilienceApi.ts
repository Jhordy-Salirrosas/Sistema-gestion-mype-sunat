import { apiClient } from '@/lib/axios';
import {
  type ChaosScenario,
  type CircuitBreakerMetrics,
  type DlqItem,
} from '../types/resilience.types';

export const resilienceApi = {
  getMetrics: async (): Promise<CircuitBreakerMetrics> => {
    const response = await apiClient.get<CircuitBreakerMetrics>('/resilience/metrics');
    return response.data;
  },

  getDlqItems: async (): Promise<DlqItem[]> => {
    const response = await apiClient.get<DlqItem[]>('/resilience/dlq');
    return response.data;
  },

  retryDlqItem: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/resilience/dlq/${id}/retry`
    );
    return response.data;
  },

  toggleChaos: async (scenario: Partial<ChaosScenario>): Promise<ChaosScenario> => {
    const response = await apiClient.post<ChaosScenario>('/resilience/chaos', scenario);
    return response.data;
  },
};
