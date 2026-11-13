import { useEffect, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { InvoiceOutboxMonitor } from './InvoiceOutboxMonitor';
import { cargarPaginasMonitor } from '../lib/invoiceMonitorData';
import { enriquecerImportesBandeja } from '../lib/invoiceBandejaAmounts';
import { aComprobanteDemo } from '../lib/invoiceApiMapper';
import { calcularResumenFiscal } from '../lib/invoiceMetrics';
import { exportarReporteSireCsv } from '../lib/invoiceExportSire';
import { invoicesApi } from '../services/invoicesApi';
import type { ComprobanteDemo } from '../data/invoiceDemoSchema';

/** La propuesta fiscal incluye documentos finales, independientemente de la cola operativa. */
export function InvoiceRvieSection() {
  const [documentos, setDocumentos] = useState<ComprobanteDemo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let activo = true;
    void cargarPaginasMonitor({ page_size: 100 })
      .then(filas => enriquecerImportesBandeja(filas, invoicesApi.getInvoiceById))
      .then(filas => { if (activo) { setDocumentos(filas.map(aComprobanteDemo)); setError(null); } })
      .catch(e => { if (activo) setError(extractApiErrorMessage(e, 'No se pudo cargar la propuesta RVIE.')); });
    return () => { activo = false; };
  }, [revision]);
  return <section aria-label="Propuesta RVIE">
    <h2>Propuesta RVIE · comprobantes registrados</h2>
    <Button variant="outline" onClick={() => setRevision(r => r + 1)}>Actualizar propuesta RVIE</Button>
    {error && <Alert variant="destructive" role="alert">{error}</Alert>}
    {documentos ? <InvoiceOutboxMonitor comprobantes={documentos} resumen={calcularResumenFiscal(documentos)} onExportarSire={exportarReporteSireCsv} /> : !error && <p role="status">Cargando propuesta RVIE…</p>}
  </section>;
}
