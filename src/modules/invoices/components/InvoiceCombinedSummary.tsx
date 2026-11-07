import { Card, CardContent, CardHeader, CardTitle, PageText } from '@/components/ui';
import { formatCurrency } from '@/lib/formatters';
import type { ResumenFiscal } from '../lib/invoiceMetrics';

/** Incluye facturas, boletas y notas que coinciden con los filtros activos. */
export const InvoiceCombinedSummary = ({ resumen }: { resumen: ResumenFiscal }) => (
  <Card size="sm">
    <CardHeader><CardTitle>Resumen combinado de comprobantes y notas</CardTitle></CardHeader>
    <CardContent>
      <PageText variant="caption">Los filtros activos se aplican a todas las clases de comprobante.</PageText>
      <PageText>Bruto aceptado {formatCurrency(resumen.totalFacturado, 'PEN')} · Notas de crédito {formatCurrency(resumen.acreditado, 'PEN')} · Notas de débito {formatCurrency(resumen.debitado, 'PEN')} · Neto {formatCurrency(resumen.netoTotalCobrar, 'PEN')}</PageText>
    </CardContent>
  </Card>
);
