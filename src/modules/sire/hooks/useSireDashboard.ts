import { useQuery } from '@tanstack/react-query';
import { sireDashboardApi } from '../services/sireDashboardApi';
import type { SireDashboardHistoryRequest } from '../types/sire.types';

export const useSireDashboardMetrics = () =>
  useQuery({
    queryKey: ['sire-dashboard-metrics'],
    queryFn: sireDashboardApi.getMetrics,
    refetchInterval: 5000,
  });

export const useSireDashboardHistory = (params: SireDashboardHistoryRequest, enabled = true) =>
  useQuery({
    queryKey: ['sire-dashboard-history', params],
    queryFn: () => sireDashboardApi.getHistory(params),
    enabled,
  });
