import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Activity, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getSireHealthSignal, type SireHealthSignal } from '../lib/sireHealthSignal';
import type { SireDashboardMetrics } from '../types/sire.types';

const signalColors: Record<SireHealthSignal, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  unknown: 'bg-muted',
};

const signalNames: Record<SireHealthSignal, string> = {
  green: 'Verde · 0 errores en los últimos 5 minutos',
  amber: 'Ámbar · 1 a 4 errores en los últimos 5 minutos',
  red: 'Rojo · 5 o más errores o circuito abierto',
  unknown: 'Sin datos recientes para determinar el semáforo',
};

export function SireHealthMetricsPanel({ metrics }: { metrics?: SireDashboardMetrics }) {
  const signal = getSireHealthSignal(metrics?.recentFailedCalls, metrics?.state);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Activity aria-hidden="true" /> Estado de conexión</CardTitle>
        <span className="text-sm font-medium">{metrics?.state ?? 'NO DISPONIBLE'}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border p-3" aria-live="polite">
          <span aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${signalColors[signal]}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{signalNames[signal]}</p>
            <p className="text-xs text-muted-foreground">
              {signal === 'red' && metrics?.state === 'OPEN'
                ? <><ShieldAlert className="mr-1 inline h-3 w-3" aria-hidden="true" />El circuito abierto activa el estado rojo.</>
                : signal === 'unknown'
                  ? 'La respuesta no incluye un conteo válido de errores recientes.'
                  : <><ShieldCheck className="mr-1 inline h-3 w-3" aria-hidden="true" />Conteo de errores recientes recibido del backend.</>}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Metric label="Llamadas totales" value={metrics?.totalCalls} />
          <Metric label="Llamadas exitosas" value={metrics?.successfulCalls} />
          <Metric label="Llamadas fallidas" value={metrics?.failedCalls} />
          <Metric label="Tasa de fallos" value={metrics ? `${metrics.failureRate}%` : undefined} />
          <Metric label="Tasa de llamadas lentas" value={metrics ? `${metrics.slowCallRate}%` : undefined} />
          <Metric label="Comprobantes en buffer" value={metrics?.bufferedInvoicesCount} />
          <Metric label="Reintentos totales" value={metrics?.totalRetries} />
          <Metric label="Errores en 5 minutos" value={metrics?.recentFailedCalls} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="MTTD" value={formatNullableMetric(metrics?.mttdSeconds)} />
          <Metric label="MTTR" value={formatNullableMetric(metrics?.mttrSeconds)} />
          <Metric label="MTBF" value={formatNullableMetric(metrics?.mtbfSeconds)} />
        </div>
      </CardContent>
    </Card>
  );
}

function formatNullableMetric(value: number | null | undefined): string | number {
  return value === null || value === undefined ? 'No disponible' : value;
}

function Metric({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-xl font-bold">{value ?? '—'}</p>
      </CardContent>
    </Card>
  );
}
