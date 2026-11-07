import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription, AlertTitle, Button, Page, PageHeader } from '@/components/ui';
import { LoaderCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { SireComprobantesTable } from '../components/SireComprobantesTable';
import { SireHealthDashboard } from '../components/SireHealthDashboard';
import { SireMetricsCards } from '../components/SireMetricsCards';
import { SirePeriodFilter } from '../components/SirePeriodFilter';
import { SireVouchersTable } from '../components/SireVouchersTable';
import { SireWorkflowPanel } from '../components/SireWorkflowPanel';
import { useSireReconciliation } from '../hooks/useSireReconciliation';
import type { ComprobanteDraft, SireBookType } from '../types/sire.types';
import { getPeriodFeedback, getRucFeedback } from '../validators/sireSchema';

const emptyVoucher = (): ComprobanteDraft => ({
  tipoComprobante: '01', serie: '', correlativo: '', baseImponible: '', igv: '', total: '',
});

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function SireReconciliationPage() {
  const [period, setPeriod] = useState(currentPeriod);
  const [bookType, setBookType] = useState<SireBookType>('RVIE_VENTAS');
  const [ruc, setRuc] = useState(() => useAuthStore.getState().activeCompany?.ruc ?? '');
  const [comprobantes, setComprobantes] = useState<ComprobanteDraft[]>([emptyVoucher()]);
  const [inputError, setInputError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const { reconcile, loading, error, data } = useSireReconciliation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowFeedback(true);
    if (getPeriodFeedback(period)) {
      setInputError(getPeriodFeedback(period));
      return;
    }
    if (getRucFeedback(ruc)) {
      setInputError(getRucFeedback(ruc));
      return;
    }
    if (comprobantes.some((row) => !row.serie.trim() || !row.correlativo.trim())) {
      setInputError('Completa la serie y el correlativo de cada comprobante.');
      return;
    }
    const mapped = comprobantes.map((row) => ({
      tipoComprobante: row.tipoComprobante,
      serie: row.serie,
      correlativo: row.correlativo,
      baseImponible: row.baseImponible.trim() ? Number(row.baseImponible) : Number.NaN,
      igv: row.igv.trim() ? Number(row.igv) : Number.NaN,
      total: row.total.trim() ? Number(row.total) : Number.NaN,
    }));
    if (mapped.some((row) =>
      ![row.baseImponible, row.igv, row.total].every((amount) => Number.isFinite(amount) && amount >= 0),
    )) {
      setInputError('Completa cada importe con un número válido y no negativo.');
      return;
    }
    setInputError(null);
    void reconcile({ period, ruc, bookType, comprobantes: mapped }).catch(() => undefined);
  };

  return (
    <Page>
      <PageHeader
        title="Conciliación fiscal SIRE"
        description="Compara los comprobantes del ERP con la información fiscal de SUNAT."
      />
      <SireHealthDashboard />
      <SireWorkflowPanel
        period={period}
        bookType={bookType}
        onPeriodChange={setPeriod}
        onBookTypeChange={setBookType}
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <label className="block max-w-xs space-y-1.5 text-sm font-medium">
          Libro a conciliar
          <select
            aria-label="Libro a conciliar"
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            value={bookType}
            disabled={loading}
            onChange={(event) => {
              if (event.target.value === 'RVIE_VENTAS' || event.target.value === 'RCE_COMPRAS') {
                setBookType(event.target.value);
              }
            }}
          >
            <option value="RVIE_VENTAS">RVIE · Ventas</option>
            <option value="RCE_COMPRAS">RCE · Compras</option>
          </select>
        </label>
        <SirePeriodFilter
          period={period}
          ruc={ruc}
          disabled={loading}
          showFeedback={showFeedback}
          onPeriodChange={setPeriod}
          onRucChange={setRuc}
        />
        <SireComprobantesTable
          comprobantes={comprobantes}
          showFeedback={showFeedback}
          onChange={setComprobantes}
        />
        <Button type="submit" disabled={loading}>
          {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {loading ? 'Conciliando…' : 'Conciliar'}
        </Button>
      </form>

      {(inputError || error) && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>No se pudo completar la conciliación</AlertTitle>
          <AlertDescription>{inputError ?? error}</AlertDescription>
        </Alert>
      )}
      {data && (
        <div className="mt-6 space-y-6">
          <SireMetricsCards summary={data.summary} />
          <SireVouchersTable results={data.results} />
          {data.results.some((result) => result.escenario === 'DUPLICADO_LLAVE') && (
            <Alert variant="warning">
              <AlertTitle>Se requiere resolución manual</AlertTitle>
              <AlertDescription>
                Las llaves duplicadas no tienen un registro elegido automáticamente. Revisa el origen indicado en cada fila.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Page>
  );
}
