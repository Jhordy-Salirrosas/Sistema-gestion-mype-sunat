import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, Page, PageGrid, PageHeader, PageText } from '@/components/ui';
import { ArrowRight, FileOutput, LoaderCircle } from 'lucide-react';
import { sireApi } from '../services/sireApi';
import { useSireReconciliationStore } from '../stores/sireReconciliationStore';

const metrics = [
  ['porcentajeCumplimiento', 'Porcentaje de cumplimiento', '%'],
  ['coincidenciaExacta', 'Coincidencias exactas', ''],
  ['diferenciaMontos', 'Diferencias de montos', ''],
  ['omisionLocal', 'Omisiones en ERP', ''],
  ['omisionSunat', 'Omisiones en SUNAT', ''],
  ['duplicadoLlave', 'Llaves duplicadas', ''],
] as const;

export default function SireClosurePage() {
  const { period, bookType, summary, isClosed, setClosed } = useSireReconciliationStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const closePeriod = async () => {
    if (!period || !bookType || !summary || isClosed || loading) return;
    if (!window.confirm(`¿Confirmas el cierre del periodo ${period}? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await sireApi.closePeriod(period, bookType);
      setClosed();
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar el periodo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Resumen de cierre SIRE"
        description={period
          ? `Métricas del periodo ${period}, informadas por el backend.`
          : 'Revisa las métricas del periodo antes del cierre fiscal.'}
      />
      {!summary && (
        <Alert variant="info">
          <AlertTitle>Resumen pendiente de conciliación</AlertTitle>
          <AlertDescription>
            Inicia el cruce para obtener las métricas calculadas por el backend para el periodo.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cerrar el periodo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success">
          <AlertTitle>Periodo cerrado</AlertTitle>
          <AlertDescription>El periodo {period} quedó cerrado correctamente y aparecerá en el historial.</AlertDescription>
        </Alert>
      )}
      <PageGrid columns={3}>
        {metrics.map(([key, label, suffix]) => (
          <Card key={key}>
            <CardContent>
              <PageText variant="caption">{label}</PageText>
              <PageText variant="metric">
                {summary ? `${summary[key].toFixed(key === 'porcentajeCumplimiento' ? 2 : 0)}${suffix}` : '—'}
              </PageText>
            </CardContent>
          </Card>
        ))}
      </PageGrid>
      <Card>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {isClosed
              ? 'El periodo ya está cerrado.'
              : 'Confirma el cierre para guardar el estado del periodo y consultarlo en el historial.'}
          </p>
          <Button type="button" onClick={() => void closePeriod()} disabled={!summary || loading || isClosed}>
            {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {loading ? 'Cerrando…' : isClosed ? 'Periodo cerrado' : 'Cerrar periodo'}
          </Button>
          <Button type="button" disabled>
            <FileOutput aria-hidden="true" />
            Generar archivo de reemplazo · Próximamente
          </Button>
        </CardContent>
      </Card>
      <Button variant="outline" asChild>
        <Link to="/sire/conciliacion">Ir a conciliación <ArrowRight aria-hidden="true" /></Link>
      </Button>
    </Page>
  );
}
