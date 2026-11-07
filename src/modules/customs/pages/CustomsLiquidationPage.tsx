import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader, Button, Card } from '@/components/ui';
import {
  CustomsSubNav,
  PendingSettlementsTable,
  PaySettlementModal,
} from '../components';
import { useCustomsSettlements } from '../hooks/useCustomsSettlements';
import { CreditCard, RefreshCw, AlertCircle, CheckCircle2, Check, ArrowLeft } from 'lucide-react';
import { type CustomsSettlementRecord } from '../types';
import { formatCurrency } from '@/lib/formatters';

export default function CustomsLiquidationPage() {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedSettlement, setSelectedSettlement] = useState<CustomsSettlementRecord | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [refreshState, setRefreshState] = useState<'idle' | 'updating' | 'updated'>('idle');

  const {
    settlements,
    isLoading,
    refetch,
    paySettlement,
  } = useCustomsSettlements();

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

  const filteredSettlements = settlements.filter((s) => {
    if (filterStatus === 'ALL') return true;
    return s.status === filterStatus;
  });

  const totalPendingPen = settlements
    .filter((s) => s.status === 'GENERADA')
    .reduce((acc, s) => acc + (s.amount_pen || 0), 0);

  const totalPaidPen = settlements
    .filter((s) => s.status === 'PAGADA')
    .reduce((acc, s) => acc + (s.amount_pen || 0), 0);

  const handleOpenPay = (settlement: CustomsSettlementRecord) => {
    setSelectedSettlement(settlement);
    setIsPayModalOpen(true);
  };

  return (
    <Page>
      <CustomsSubNav />

      <PageHeader
        title="Liquidación y Pago de Tributos (CDA)"
        description="Cobranza oficial SUNAT (CDA formato 18D), derechos arancelarios y pagos bancarios de la DAM."
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/customs/declarations')}
          className="text-xs gap-1.5 h-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Despacho y DAM
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshState === 'updating'}
          className="text-xs gap-1.5 h-8 min-w-[170px] justify-center transition-all"
        >
          {refreshState === 'updating' && (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              Actualizando liquidaciones...
            </>
          )}
          {refreshState === 'updated' && (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500 font-medium">Liquidaciones al día</span>
            </>
          )}
          {refreshState === 'idle' && (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Actualizar Liquidaciones
            </>
          )}
        </Button>
      </PageHeader>

      <div className="space-y-4">
        {/* Tarjetas de Resumen Financiero */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-3 bg-amber-500/5 border-amber-500/20 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Exigible SUNAT Pendiente</p>
              <p className="text-base font-bold font-mono text-amber-700 dark:text-amber-300">
                {formatCurrency(totalPendingPen, 'PEN')}
              </p>
            </div>
          </Card>

          <Card className="p-3 bg-emerald-500/5 border-emerald-500/20 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Tributos Pagados</p>
              <p className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {formatCurrency(totalPaidPen, 'PEN')}
              </p>
            </div>
          </Card>

          <Card className="p-3 bg-primary/5 border-primary/20 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Total Liquidaciones</p>
              <p className="text-base font-bold font-mono">{settlements.length || 2} documentos</p>
            </div>
          </Card>
        </div>

        {/* Barra de Filtros */}
        <div className="flex gap-1.5 border-b border-border pb-2 text-xs">
          {[
            { id: 'ALL', label: 'Todas las Liquidaciones' },
            { id: 'GENERADA', label: 'Pendientes de Pago' },
            { id: 'PAGADA', label: 'Pagadas (Levante Concedido)' },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={filterStatus === tab.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus(tab.id)}
              className="h-7 text-xs px-2.5"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tabla de Liquidaciones con CDA */}
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
            Cargando liquidaciones oficiales de SUNAT...
          </div>
        ) : (
          <PendingSettlementsTable
            settlements={filteredSettlements}
            onOpenPayModal={handleOpenPay}
          />
        )}
      </div>

      <PaySettlementModal
        settlement={selectedSettlement}
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        onSubmit={async (settlementId, payload) => {
          await paySettlement(settlementId, payload);
          setIsPayModalOpen(false);
        }}
      />
    </Page>
  );
}
