import { useState } from 'react';
import { Page, PageHeader, Button, Card, Alert, AlertTitle, AlertDescription } from '@/components/ui';
import {
  CustomsSubNav,
  SireAuditTable,
  ExportSireButton,
} from '../components';
import { useSireAnnex8_4 } from '../hooks/useSireAnnex8_4';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, ShieldCheck, Scale, FileCheck2, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function SireExportAuditPage() {
  const { user } = useAuth();
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('10');
  const [refreshState, setRefreshState] = useState<'idle' | 'updating' | 'updated'>('idle');

  const period = `${year}${month}`;
  const ruc = user?.companyRuc || '20601012341';

  const {
    records,
    isLoading,
    refetch,
    downloadSireTxt,
  } = useSireAnnex8_4(period);

  const handleRefresh = async () => {
    if (refreshState !== 'idle') return;
    setRefreshState('updating');
    try {
      await Promise.all([
        refetch(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
      setRefreshState('updated');
      setTimeout(() => {
        setRefreshState('idle');
      }, 1500);
    } catch {
      setRefreshState('idle');
    }
  };

  const totalTaxableBase = records.reduce((acc, r) => acc + (r.taxable_base_pen || 0), 0);
  const totalIgvIpm = records.reduce((acc, r) => acc + (r.igv_ipm_pen || 0), 0);
  const totalPerception = records.reduce((acc, r) => acc + (r.perception_pen || 0), 0);

  const handleExportTxt = () => {
    downloadSireTxt(ruc, year, month);
  };

  return (
    <Page>
      <CustomsSubNav />

      <PageHeader
        title="Registro de Compras de Importación — SIRE"
        description="Auditoría fiscal y exportación oficial del RCE Anexo 8.4 para Comprobantes Tipo 50 (DAM)."
      >
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshState === 'updating'}
            className="text-xs gap-1.5 h-8 min-w-[105px] justify-center transition-all"
          >
            {refreshState === 'updating' && (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                Actualizando...
              </>
            )}
            {refreshState === 'updated' && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Actualizado</span>
              </>
            )}
            {refreshState === 'idle' && (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Actualizar
              </>
            )}
          </Button>

          <ExportSireButton onExport={handleExportTxt} isLoading={isLoading} />
        </div>
      </PageHeader>

      <div className="space-y-4">
        {/* Selector de Período y Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card border border-border rounded-lg text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-muted-foreground">Año Fiscal:</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-8 px-2 rounded-md border border-input bg-background font-mono"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="font-semibold text-muted-foreground">Mes:</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-8 px-2 rounded-md border border-input bg-background font-mono"
              >
                <option value="09">09 - Setiembre</option>
                <option value="10">10 - Octubre</option>
                <option value="11">11 - Noviembre</option>
                <option value="12">12 - Diciembre</option>
              </select>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground font-mono">
            RUC Emisor: <span className="font-bold text-foreground">{ruc}</span> · Archivo: LE{ruc}{period}00080400001111.txt
          </p>
        </div>

        {/* Alerta Normativa R.S. 203-2003/SUNAT */}
        <Alert className="bg-primary/5 border-primary/20 text-xs">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertTitle className="font-bold text-foreground">
            Criterio de Deducción del Crédito Fiscal Aduanero (R.S. N° 203-2003/SUNAT)
          </AlertTitle>
          <AlertDescription className="text-muted-foreground mt-0.5">
            Conforme a la normativa tributaria vigente, el IGV e IPM de importaciones consignado en la DUA Tipo 50
            se registra en el Registro de Compras del mes en que se efectúa la cancelación de la cuota 0010 ante el banco.
          </AlertDescription>
        </Alert>

        {/* Tarjetas de Resumen Tributario */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-3 bg-card border-border flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Base Imponible Total</p>
              <p className="text-base font-bold font-mono text-foreground">
                {formatCurrency(totalTaxableBase, 'PEN')}
              </p>
            </div>
          </Card>

          <Card className="p-3 bg-card border-border flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileCheck2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Crédito Fiscal IGV + IPM</p>
              <p className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {formatCurrency(totalIgvIpm, 'PEN')}
              </p>
            </div>
          </Card>

          <Card className="p-3 bg-card border-border flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Percepción IGV (Cuota 0026)</p>
              <p className="text-base font-bold font-mono text-amber-700 dark:text-amber-300">
                {formatCurrency(totalPerception, 'PEN')}
              </p>
            </div>
          </Card>
        </div>

        {/* Grilla Oficial SIRE Anexo 8.4 */}
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
            Generando propuesta fiscal SIRE Anexo 8.4...
          </div>
        ) : (
          <SireAuditTable records={records} />
        )}
      </div>
    </Page>
  );
}
