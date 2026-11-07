import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { SireDashboardHistoryPoint } from '../types/sire.types';

interface Props {
  history: SireDashboardHistoryPoint[];
}

interface ChartProps {
  title: string;
  label: string;
  points: SireDashboardHistoryPoint[];
  getValue: (point: SireDashboardHistoryPoint) => number | null;
  maxValue: number;
  color: string;
  emptyLabel: string;
}

function Chart({ title, label, points, getValue, maxValue, color, emptyLabel }: ChartProps) {
  const coords = points.map((point, index) => {
    const value = getValue(point);
    return {
      x: points.length === 1 ? 160 : 16 + (index * 288) / (points.length - 1),
      y: value === null ? null : 104 - (Math.min(Math.max(value, 0), maxValue) / maxValue) * 88,
    };
  });
  const segments: { x: number; y: number }[][] = [];
  const nullPoints = points.filter((point) => getValue(point) === null);
  let segmentBreak = true;
  coords.forEach(({ x, y }) => {
    if (y === null) {
      segmentBreak = true;
    } else if (segmentBreak) {
      segments.push([{ x, y }]);
      segmentBreak = false;
    } else {
      segments[segments.length - 1].push({ x, y });
    }
  });
  const hasValues = coords.some(({ y }) => y !== null);

  return (
    <Card className="min-w-0">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Sin historial disponible.
          </p>
        ) : !hasValues ? (
          <div className="space-y-2">
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{emptyLabel}</p>
            {nullPoints.map((point) => (
              <p key={point.timestamp} className="text-xs text-muted-foreground">
                {point.timestamp}: Sin llamadas observadas
              </p>
            ))}
          </div>
        ) : (
          <>
            <svg role="img" aria-label={label} viewBox="0 0 320 120" className="h-32 w-full">
              <line x1="16" y1="104" x2="304" y2="104" stroke="currentColor" className="text-border" />
              {segments.map((segment, index) => (
                <polyline
                  key={index}
                  points={segment.map(({ x, y }) => `${x},${y}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {coords.map(({ x, y }, index) =>
                y === null ? null : <circle key={`${points[index].timestamp}-${x}`} cx={x} cy={y} r="3" fill={color} />,
              )}
            </svg>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{points[0].timestamp}</span>
              <span>{points[points.length - 1].timestamp}</span>
            </div>
            {nullPoints.length > 0 && title.includes('Disponibilidad') && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {nullPoints.map((point) => (
                  <li key={point.timestamp}>{point.timestamp}: Sin llamadas observadas</li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SireHealthHistoryCharts({ history }: Props) {
  return (
    <section aria-label="Gráficas históricas de SIRE" className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
      <Chart
        title="Reintentos en el tiempo"
        label="Gráfica histórica de reintentos"
        points={history}
        getValue={(point) => point.retries}
        maxValue={Math.max(1, ...history.map((point) => point.retries))}
        color="#f59e0b"
        emptyLabel="Sin reintentos registrados en este rango."
      />
      <Chart
        title="Disponibilidad en el tiempo"
        label="Gráfica histórica de disponibilidad"
        points={history}
        getValue={(point) => point.availabilityPercent}
        maxValue={100}
        color="#10b981"
        emptyLabel="Sin llamadas observadas en este rango."
      />
    </section>
  );
}
