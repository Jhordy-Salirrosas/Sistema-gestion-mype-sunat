import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle, Button } from '@/components/ui';
import { RefreshCw } from 'lucide-react';
import { useSireDashboardMetrics } from '../hooks/useSireDashboard';
import { SireHealthHistoryPanel } from './SireHealthHistoryPanel';
import { SireHealthMetricsPanel } from './SireHealthMetricsPanel';
import { SireApiError } from '../services/sireApi';

export function SireHealthDashboard() {
  const { data, error, isPending, isError, isRefetching, refetch } = useSireDashboardMetrics();
  const [historyNotFound, setHistoryNotFound] = useState(false);
  const metricsNotFound = error instanceof SireApiError && error.status === 404;

  if (metricsNotFound || historyNotFound) return null;

  return (
    <section aria-label="Dashboard de conexión SIRE" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Conexión y resiliencia SIRE</h2>
          <p className="text-sm text-muted-foreground">
            Estado del circuito, contadores y disponibilidad del servicio.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isRefetching}>
          <RefreshCw aria-hidden="true" />
          Actualizar estado
        </Button>
      </div>
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar el estado de conexión</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'No fue posible consultar las métricas del Dashboard SIRE.'}
            {' '}La conciliación sigue disponible.
          </AlertDescription>
        </Alert>
      )}
      {!data && isPending && <p role="status">Cargando métricas SIRE…</p>}
      <SireHealthMetricsPanel metrics={data} />
      <SireHealthHistoryPanel onNotFound={() => setHistoryNotFound(true)} />
    </section>
  );
}
