import { Button } from '@/components/ui';
import { orientacionError } from '../lib/invoiceErrorGuidance';

/** Resumen de listado; la orientación completa permanece en el detalle. */
export function InvoiceIssueSummary({ codigo, onVerDetalle }: {
  codigo?: string | null;
  onVerDetalle: () => void;
}) {
  const guia = orientacionError(codigo);
  return <div className="mx-auto flex min-w-0 max-w-80 items-center gap-2">
    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={guia.mensaje}>{guia.mensaje}</span>
    <Button type="button" size="xs" variant="outline" onClick={event => { event.stopPropagation(); onVerDetalle(); }}>Ver detalle</Button>
  </div>;
}
