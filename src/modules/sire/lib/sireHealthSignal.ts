import type { CircuitBreakerStatus } from '@/stores/uiStore';

export type SireHealthSignal = 'green' | 'amber' | 'red' | 'unknown';

export const getSireHealthSignal = (
  recentErrorCount: number | undefined,
  circuitState?: CircuitBreakerStatus,
): SireHealthSignal => {
  if (circuitState === 'OPEN') return 'red';
  if (
    recentErrorCount === undefined ||
    !Number.isInteger(recentErrorCount) ||
    recentErrorCount < 0
  ) {
    return 'unknown';
  }
  if (recentErrorCount >= 5) return 'red';
  if (recentErrorCount >= 1) return 'amber';
  return 'green';
};
