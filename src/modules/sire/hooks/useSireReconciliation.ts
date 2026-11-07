import { useCallback, useState } from 'react';
import { sireApi } from '../services/sireApi';
import { useSireReconciliationStore } from '../stores/sireReconciliationStore';
import type { ReconcileRequest, ReconcileResponse } from '../types/sire.types';

export const useSireReconciliation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReconcileResponse | null>(null);
  const clearSummary = useSireReconciliationStore((state) => state.clearSummary);
  const setSummary = useSireReconciliationStore((state) => state.setSummary);

  const reconcile = useCallback(async (payload: ReconcileRequest) => {
    setLoading(true);
    setError(null);
    setData(null);
    clearSummary();
    try {
      const result = await sireApi.reconcile(payload);
      setData(result);
      setSummary(result.period, result.bookType, result.summary);
      return result;
    } catch (cause) {
      const message = cause instanceof Error
        ? cause.message
        : 'Ocurrió un error inesperado al conciliar los comprobantes.';
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [clearSummary, setSummary]);

  return { reconcile, loading, error, data };
};
