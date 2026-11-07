import { useQuery } from '@tanstack/react-query';
import { resilienceApi } from '../services/resilienceApi';
import { useUiStore } from '@/stores/uiStore';
import { useEffect } from 'react';

export const useResilienceMetrics = () => {
  const { setSunatCircuitBreakerStatus } = useUiStore();

  const query = useQuery({
    queryKey: ['resilience-metrics'],
    queryFn: resilienceApi.getMetrics,
    refetchInterval: 5000, // Sondeo en tiempo real cada 5 segundos
  });

  // Sincronizar el estado del Circuit Breaker con el banner global
  useEffect(() => {
    if (query.data?.state) {
      setSunatCircuitBreakerStatus(query.data.state);
    }
  }, [query.data?.state, setSunatCircuitBreakerStatus]);

  return query;
};
