import { CircuitBreakerWidget } from '../components/CircuitBreakerWidget';
import { OfflineQueueSection } from '../components/OfflineQueueSection';
import { useChaosToggle } from '../hooks/useChaosToggle';
import { useResilienceMetrics } from '../hooks/useResilienceMetrics';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Page,
  PageGrid,
  PageGridItem,
  PageHeader,
  PageText,
} from '@/components/ui';
import { CheckCircle2, Flame, RefreshCw, Zap } from 'lucide-react';

export default function ResilienceDashboardPage() {
  const { data: metrics, refetch, isRefetching } = useResilienceMetrics();
  const { isChaosActive, isPending, isError, toggle } = useChaosToggle();

  return (
    <Page>
      <PageHeader
        title="Dashboard de Resiliencia y Caos"
        description="Monitoreo del Circuit Breaker, reintentos en Dead Letter Queue (DLQ) e inyección de contingencias"
        badge={
          <Badge variant="outline">
            Live Resilience
          </Badge>
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw aria-hidden="true" />
          Refrescar Métricas
        </Button>
      </PageHeader>

      <PageGrid columns={3}>
        {/* Widget principal del Circuit Breaker */}
        <PageGridItem span={2}>
          <CircuitBreakerWidget metrics={metrics} />
        </PageGridItem>

        {/* Tarjeta de Control de Caos */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Flame aria-hidden="true" />
              Simulador de Caos SUNAT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PageText variant="caption">
              Herramienta de pruebas de resiliencia según ISO/IEC 25010 para validar el comportamiento offline.
            </PageText>
            <Card>
              <PageText variant="label">Simular Caída 500 SUNAT</PageText>
              <PageText variant="caption">Fuerza estado OPEN en Circuit Breaker</PageText>
              <Button
                variant={isChaosActive ? 'destructive' : 'default'}
                size="sm"
                onClick={toggle}
                disabled={isPending}
              >
                {isChaosActive ? 'Desactivar caos' : 'Activar caída 500'}
              </Button>
              <Badge variant={isChaosActive ? 'destructive' : 'secondary'}>
                {isChaosActive ? 'Caos activo' : 'Inactivo'}
              </Badge>
              {isError && (
                <PageText variant="caption">
                  No se pudo contactar al backend de resiliencia. Verifica que
                  los endpoints <code>/api/v1/resilience</code> estén
                  desplegados.
                </PageText>
              )}
            </Card>
          </CardContent>
        </Card>
      </PageGrid>

      {/* Tarjetas resumen de llamadas */}
      <PageGrid columns={3}>
        <Card>
          <CardContent>
            <CheckCircle2 aria-hidden="true" />
            <PageText variant="caption">
              Llamadas Exitosas
              <PageText as="span" variant="metric">{metrics?.successfulCalls ?? 0}</PageText>
            </PageText>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Zap aria-hidden="true" />
            <PageText variant="caption">
              Total Procesadas
              <PageText as="span" variant="metric">{metrics?.totalCalls ?? 0}</PageText>
            </PageText>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Flame aria-hidden="true" />
            <PageText variant="caption">
              Llamadas con Fallo
              <PageText as="span" variant="metric">{metrics?.failedCalls ?? 0}</PageText>
            </PageText>
          </CardContent>
        </Card>
      </PageGrid>

      {/* [TA-27] Cola offline de comprobantes con IndexedDB */}
      <OfflineQueueSection />
    </Page>
  );
}
