import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle, Button } from '@/components/ui';
import { useSireDashboardHistory } from '../hooks/useSireDashboard';
import type { SireDashboardGranularity, SireDashboardHistoryRequest } from '../types/sire.types';
import { SireHealthHistoryCharts } from './SireHealthHistoryCharts';

const HISTORY_LIMIT = 24;
const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;

const getDefaultRange = () => {
  const end = new Date();
  return {
    end: end.toISOString(),
    start: new Date(end.getTime() - DEFAULT_RANGE_MS).toISOString(),
  };
};
const toDateTimeInput = (iso: string) => iso.slice(0, 16);
const toIso = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};

export function SireHealthHistoryPanel({ onNotFound }: { onNotFound?: () => void } = {}) {
  const [range, setRange] = useState(getDefaultRange);
  const [granularity, setGranularity] = useState<SireDashboardGranularity>('hour');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(HISTORY_LIMIT);
  const rangeIsValid = !Number.isNaN(Date.parse(range.start)) && !Number.isNaN(Date.parse(range.end))
    && new Date(range.start).getTime() < new Date(range.end).getTime();
  const request: SireDashboardHistoryRequest = { ...range, granularity, limit, offset };
  const { data, error, isPending, isError, refetch } = useSireDashboardHistory(request, rangeIsValid);

  useEffect(() => {
    if (isError && typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
      onNotFound?.();
    }
  }, [error, isError, onNotFound]);

  const changeGranularity = (value: string) => {
    if (value === 'minute' || value === 'hour' || value === 'day') {
      setGranularity(value);
      setOffset(0);
      setLimit(HISTORY_LIMIT);
    }
  };

  return (
    <section aria-label="Historial de reintentos y disponibilidad" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold">Historial de reintentos y disponibilidad</h3>
          <p className="break-all text-xs text-muted-foreground">
            Rango consultado: {range.start} — {range.end}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">Inicio
              <input aria-label="Fecha inicial" type="datetime-local" className="h-9 rounded-lg border border-input bg-background px-2.5" value={toDateTimeInput(range.start)} onChange={(event) => setRange((current) => ({ ...current, start: toIso(event.target.value) }))} />
            </label>
            <label className="grid gap-1 text-xs">Fin
              <input aria-label="Fecha final" type="datetime-local" className="h-9 rounded-lg border border-input bg-background px-2.5" value={toDateTimeInput(range.end)} onChange={(event) => setRange((current) => ({ ...current, end: toIso(event.target.value) }))} />
            </label>
          </div>
          {!rangeIsValid && <p role="alert" className="text-xs text-destructive">Ingresa fechas ISO válidas y un inicio anterior al fin.</p>}
        </div>
        <label className="grid gap-1 text-sm">
          Granularidad
          <select
            aria-label="Granularidad del historial"
            className="h-9 rounded-lg border border-input bg-background px-2.5"
            value={granularity}
            onChange={(event) => changeGranularity(event.target.value)}
          >
            <option value="minute">Por minuto</option>
            <option value="hour">Por hora</option>
            <option value="day">Por día</option>
          </select>
        </label>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar el historial de resiliencia</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'No fue posible consultar el historial de resiliencia.'}
            {' '}El historial de conciliaciones permanece disponible en su pantalla.
          </AlertDescription>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Reintentar consulta
          </Button>
        </Alert>
      )}
      {!data && isPending && <p role="status">Cargando historial de reintentos y disponibilidad…</p>}
      {data && <SireHealthHistoryCharts history={data.points} />}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {data ? `Mostrando ${data.points.length} puntos · Límite ${data.limit} · Desplazamiento ${data.offset}` : ''}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!data || data.offset === 0 || isPending}
            onClick={() => {
              if (!data) return;
              setLimit(data.limit);
              setOffset(Math.max(0, data.offset - data.limit));
            }}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!data?.hasMore || isPending}
            onClick={() => {
              if (!data) return;
              setLimit(data.limit);
              setOffset(data.offset + data.limit);
            }}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </section>
  );
}
