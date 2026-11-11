import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp } from 'lucide-react';
import { Badge, Card, Page, PageHeader } from '@/components/ui';
import { PeriodInput } from '@/components/common/PeriodInput';
import { invoicesApi } from '../services/invoicesApi';
import { periodoActual } from '../lib/invoiceMetricsPeriodo';

const money = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoicesDashboardPage() {
  const [period, setPeriod] = useState(periodoActual);
  const metricas = useQuery({ queryKey: ['invoices-dashboard-metrics', period], queryFn: () => invoicesApi.getMetrics(period) });
  const alertas = useQuery({ queryKey: ['invoices-dashboard-alertas'], queryFn: () => invoicesApi.getAlertas() });
  const m = metricas.data;
  const dlqPendientes = alertas.data?.dlq.pendientes ?? 0;
  const certificadoGrave = alertas.data?.certificado.gravedad === 'CRITICO';
  const motivoAlerta = dlqPendientes > 0
    ? `DLQ ${dlqPendientes}`
    : certificadoGrave
      ? 'Certificado'
      : 'Certificado sin datos';

  const kpis = [
    { label: 'Facturado neto', value: money(m?.facturado ?? 0), icon: TrendingUp },
    { label: 'Comprobantes registrados (total)', value: m?.total ?? '—', icon: FileText },
    { label: 'Aceptados / observados', value: m?.aceptados ?? 0, icon: CheckCircle2 },
    { label: 'Sin confirmación SUNAT (incluye cola)', value: m?.pendientes ?? 0, icon: Clock },
    { label: 'Rechazados', value: m?.rechazados ?? 0, icon: AlertTriangle },
    { label: 'Tasa de aceptación', value: `${(m?.tasaAceptacion ?? 0).toFixed(1)} %`, icon: Activity },
  ];

  return (
    <Page>
      <PageHeader title="Resumen de facturación" />
      <p className="min-w-0 whitespace-normal break-words text-sm text-muted-foreground">Total de documentos del período; neto solo de aceptados/observados: facturas y boletas menos NC más notas de débito (ND).</p>
      <p className="text-xs text-muted-foreground">Sin confirmación incluye comprobantes en cola o enviados sin respuesta definitiva.</p>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="space-y-1.5">
          <label htmlFor="invoices-dashboard-period" className="text-xs font-medium">Período</label>
          <PeriodInput id="invoices-dashboard-period" value={period} onChange={setPeriod} />
        </div>
        <Badge variant={m && m.rechazados > 0 ? 'destructive' : 'outline'}>
          {m && m.rechazados > 0 ? 'Requiere revisión' : 'Sin rechazos'}
        </Badge>
        <Badge
          variant={alertas.data?.gravedadGlobal === 'CRITICO' ? 'destructive' : 'secondary'}
          title={alertas.data ? `${alertas.data.certificado.mensaje} ${alertas.data.dlq.mensaje}` : undefined}
        >
          Alerta: {alertas.data?.gravedadGlobal ?? 'SIN_DATOS'}
          {alertas.data?.gravedadGlobal === 'CRITICO' ? ` · ${motivoAlerta}` : ''}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mb-5">
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span><Icon className="h-4 w-4" /></div>
            <p className="text-2xl font-bold mt-2">{value}</p>
          </Card>
        ))}
      </div>

      {alertas.data && alertas.data.gravedadGlobal !== 'OK' ? (
        <Card className="p-4 mb-5 text-sm">
          <p className="font-semibold mb-1">Alertas operativas</p>
          <p className="text-muted-foreground">Certificado: {alertas.data.certificado.mensaje}</p>
          <p className="text-muted-foreground">Cola DLQ: {alertas.data.dlq.mensaje}</p>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Emitir comprobante', '/invoices/emision'],
          ['Facturas y boletas', '/invoices/facturas'],
          ['Monitor Outbox y CDR', '/invoices/monitor'],
          ['Notas de crédito/débito', '/invoices/notas'],
          ['Anulación y resúmenes', '/invoices/bajas'],
          ['Configuración', '/invoices/configuracion'],
        ].map(([title, to]) => (
          <Link key={to} to={to} className="rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">Ir al módulo de facturación</p>
          </Link>
        ))}
      </div>
    </Page>
  );
}
