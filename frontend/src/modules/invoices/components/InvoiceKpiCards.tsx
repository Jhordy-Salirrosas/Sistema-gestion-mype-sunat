/**
 * Tarjetas KPI fiscales del módulo de Facturación (M1).
 *
 * Muestran, del periodo consultado: total facturado (base + IGV), comprobantes
 * aceptados con su tasa de éxito, pendientes en la cola Outbox y rechazos/DLQ.
 */
import {
  Badge,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  PageGrid,
  PageText,
} from '@/components/ui';
import { formatCurrency } from '@/lib/formatters';
import type { ResumenFiscal } from '../lib/invoiceMetrics';

interface InvoiceKpiCardsProps {
  resumen: ResumenFiscal;
  /** `true` cuando las tarjetas reflejan un filtro y no el periodo completo. */
  filtrado?: boolean;
  mostrarNotas?: boolean;
}

/** Tarjetas de métricas fiscales del periodo. */
export const InvoiceKpiCards = ({
  resumen,
  filtrado = false,
  mostrarNotas = true,
}: InvoiceKpiCardsProps) => {
  const despacho =
    resumen.despachoPromedioMs > 0
      ? `${resumen.despachoPromedioMs} ms promedio`
      : 'Sin despachos pendientes';

  return (
    <PageGrid columns={4}>
      <Card size="sm" data-kpi="total">
        <CardHeader>
          <CardTitle>Total Facturado del Periodo</CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-[10px]">
              {filtrado ? 'Vista filtrada' : 'Bruto aceptado'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-1">
          <PageText variant="metric">
            {formatCurrency(resumen.totalFacturado, 'PEN')}
          </PageText>
          <PageText variant="caption">
            Base sin notas {formatCurrency(resumen.baseTotal, 'PEN')} · IGV sin notas{' '}
            {formatCurrency(resumen.igvTotal, 'PEN')}
          </PageText>
          {mostrarNotas && resumen.acreditado !== 0 && <PageText variant="caption">
            Acreditado {formatCurrency(resumen.acreditado, 'PEN')} · Neto de esta vista (sin notas) {formatCurrency(resumen.netoTotalCobrar, 'PEN')}
          </PageText>}
        </CardContent>
      </Card>

      <Card size="sm" data-kpi="aceptados">
        <CardHeader>
          <CardTitle>Aceptados SUNAT</CardTitle>
          <CardAction>
            <Badge className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700">
              Verde
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-1">
          <PageText variant="metric">{resumen.aceptados}</PageText>
          <PageText variant="caption">
            Tasa de éxito en facturas y boletas {resumen.tasaExito}%
          </PageText>
          <PageText variant="caption">
            Observados 4xxx: {resumen.observados}
          </PageText>
        </CardContent>
      </Card>

      <Card size="sm" data-kpi="en-cola">
        <CardHeader>
          <CardTitle>En Cola Outbox</CardTitle>
          <CardAction>
            <Badge className="border-blue-500/40 bg-blue-500/10 text-[10px] text-blue-700">
              Azul
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-1">
          <PageText variant="metric">{resumen.enCola}</PageText>
          <PageText variant="caption">{despacho}</PageText>
        </CardContent>
      </Card>

      <Card size="sm" data-kpi="rechazados">
        <CardHeader>
          <CardTitle>Rechazos / Sin confirmar</CardTitle>
          <CardAction>
            <Badge variant="destructive" className="text-[10px]">
              Rojo
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-1">
          <PageText
            variant={resumen.rechazados + resumen.erroresRed > 0 ? 'metric-destructive' : 'metric'}
          >
            {resumen.rechazados + resumen.erroresRed}
          </PageText>
          <PageText variant="caption">
            Rechazos SUNAT: {resumen.rechazosSunat ?? 0} · Bloqueados localmente: {resumen.bloqueadosLocalmente ?? 0} · Origen no confirmado: {resumen.rechazosSinOrigen ?? resumen.rechazados} · Errores de red: {resumen.erroresRed}
          </PageText>
        </CardContent>
      </Card>
    </PageGrid>
  );
};
