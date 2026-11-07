import { Card, CardContent, PageGrid, PageText } from '@/components/ui';
import type { ReconcileSummary } from '../types/sire.types';

interface Props {
  summary: ReconcileSummary;
}

const metrics: { key: keyof ReconcileSummary; label: string; color?: string }[] = [
  { key: 'total', label: 'Total conciliado' },
  { key: 'coincidenciaExacta', label: 'Coincidencias exactas', color: 'text-emerald-700' },
  { key: 'diferenciaMontos', label: 'Diferencias de montos', color: 'text-amber-700' },
  { key: 'omisionLocal', label: 'Omisiones en ERP', color: 'text-blue-700' },
  { key: 'omisionSunat', label: 'Omisiones en SUNAT', color: 'text-orange-700' },
  { key: 'duplicadoLlave', label: 'Llaves duplicadas', color: 'text-red-700' },
];

export const SireMetricsCards = ({ summary }: Props) => (
  <section aria-label="Resumen de conciliación" className="space-y-3">
    <PageGrid columns={3}>
      {metrics.map(({ key, label, color }) => (
        <Card key={key}>
          <CardContent>
            <PageText variant="caption">{label}</PageText>
            <PageText variant="metric" className={color}>{summary[key]}</PageText>
          </CardContent>
        </Card>
      ))}
    </PageGrid>
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2">
        <PageText variant="caption">Porcentaje de cumplimiento informado por el backend</PageText>
        <PageText variant="metric">{summary.porcentajeCumplimiento.toFixed(2)}%</PageText>
      </CardContent>
    </Card>
  </section>
);
