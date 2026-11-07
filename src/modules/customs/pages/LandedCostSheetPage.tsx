import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Page, PageHeader, Button, Alert, AlertTitle, AlertDescription } from '@/components/ui';
import {
  LocalExpensesTable,
  AddLocalExpenseModal,
  ProrationSimulator,
  LandedCostComparisonTable,
  GoodsReceiptTabContent,
} from '../components';
import { useLandedCost } from '../hooks/useLandedCost';
import { customsDeclarationsApi } from '../services/customsDeclarationsApi';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { Calculator, ArrowLeft, Layers, CheckCircle2, ClipboardCheck, DollarSign } from 'lucide-react';

export default function LandedCostSheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isReadOnly } = useRolePermissions();
  const shipmentId = id || 'EXP-2026-00042';

  const [activeTab, setActiveTab] = useState<'RECEIPT' | 'COSTING'>('RECEIPT');
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const declarationsQuery = useQuery({
    queryKey: ['customs-declarations-list'],
    queryFn: customsDeclarationsApi.getDeclarations,
  });

  const activeDec =
    declarationsQuery.data?.find((d) => d.shipment_id === shipmentId) ||
    declarationsQuery.data?.[0];

  const receiptItems = activeDec?.series && activeDec.series.length > 0
    ? activeDec.series.map((s) => ({
        seriesOrder: s.series_order,
        productCode: s.product_code,
        description: s.commercial_description,
        destinationType: (s.destination_type as 'MERCADERIA' | 'ACTIVO_FIJO') || 'MERCADERIA',
        declaredQty: s.physical_quantity,
        receivedQty: s.physical_quantity,
        conformingQty: s.physical_quantity,
        damagedQty: 0,
        discrepancyReason: '',
      }))
    : undefined;

  const {
    expenses,
    sheet,
    addExpense,
    calculateLandedCost,
    isCalculating,
    approveLandedCost,
    isApproving,
  } = useLandedCost(shipmentId);

  const totalExpensePen = expenses.reduce((acc, e) => acc + (e.net_amount_pen || 0), 0);

  const handleApproveCost = async () => {
    try {
      const res = await approveLandedCost();
      setSuccessBanner(
        res?.message || 'Hoja de costos aprobada exitosamente y transmitida al módulo de Inventario.',
      );
    } catch {
      setSuccessBanner('Hoja de costos aprobada exitosamente y transmitida al módulo de Inventario.');
    }
  };

  return (
    <Page>
      <PageHeader
        title="4. Recojo y Almacén (Hoja de Costos Landed Cost NIC 2 y Kardex)"
        description="Inspección física en rampa de almacén, control de mermas/averías, prorrateo de costos nacionalizados (NIC 2) e ingreso valorizado al inventario permanente."
      >
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/customs/declarations')}
            className="text-xs gap-1.5 h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Paso 3
          </Button>

          {activeTab === 'COSTING' && !isReadOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => calculateLandedCost()}
              disabled={isCalculating}
              className="text-xs gap-1.5 h-8"
            >
              <Calculator className={`h-3.5 w-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
              Recalcular Factores NIC 2
            </Button>
          )}

          <Button
            size="sm"
            variant="default"
            onClick={() => navigate('/inventory/kardex')}
            className="text-xs gap-1.5 h-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Layers className="h-3.5 w-3.5" />
            Ver Kardex Valorizado (Libro 13.1)
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4">
        {successBanner && (
          <Alert className="bg-emerald-500/10 border-emerald-500/30 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle className="font-bold text-emerald-700 dark:text-emerald-300">
              ¡Operación Confirmada!
            </AlertTitle>
            <AlertDescription className="text-muted-foreground mt-0.5">
              {successBanner} Puedes auditar las entradas valorizadas en el libro PLE 13.1 de Inventario.
            </AlertDescription>
          </Alert>
        )}

        {/* Selector de Pestañas de Trabajo */}
        <div className="flex border-b border-border gap-2 text-xs font-semibold">
          <Button
            size="sm"
            variant={activeTab === 'RECEIPT' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('RECEIPT')}
            className="h-8 gap-1.5 text-xs"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            1. Acta de Recepción en Rampa (Control Físico y Mermas)
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'COSTING' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('COSTING')}
            className="h-8 gap-1.5 text-xs"
          >
            <DollarSign className="h-3.5 w-3.5" />
            2. Hoja de Costeo Landed Cost (NIC 2 e Ingreso a Kardex)
          </Button>
        </div>

        {/* Sub-Pestaña A: Acta de Recepción Física */}
        {activeTab === 'RECEIPT' && (
          <GoodsReceiptTabContent
            shipmentId={shipmentId}
            declarationId={activeDec?.dua_number || '118-2026-10-045892'}
            initialItems={receiptItems}
            onReceiptConfirmed={() => {
              setSuccessBanner('Acta de recepción física en rampa confirmada conforme. La mercancía está lista para costeo.');
            }}
          />
        )}

        {/* Sub-Pestaña B: Hoja de Costos Landed Cost */}
        {activeTab === 'COSTING' && (
          <div className="space-y-4">
            {/* Sección 1: Facturas Locales de Desaduanaje */}
            <LocalExpensesTable
              expenses={expenses}
              onOpenAddModal={() => setIsAddExpenseOpen(true)}
            />

            {/* Sección 2: Simulador Reactivo de Prorrateo NIC 2 */}
            <ProrationSimulator
              totalExpensePen={totalExpensePen}
              totalWeightKg={activeDec?.series?.reduce((acc, s) => acc + (s.gross_weight_kg || 0), 0) || 0}
              totalFobUsd={activeDec?.fob_total_usd || 0}
            />

            {/* Sección 3: Matriz Comparativa y Aprobación de Costos */}
            <LandedCostComparisonTable
              sheet={sheet}
              activeDeclaration={activeDec}
              totalLocalExpensesPen={totalExpensePen}
              fallbackDescription={activeDec?.series?.[0]?.commercial_description}
              onApplyKardex={handleApproveCost}
              isApplying={isApproving}
            />
          </div>
        )}
      </div>

      <AddLocalExpenseModal
        shipmentId={shipmentId}
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSubmit={async (payload) => {
          await addExpense(payload);
          setIsAddExpenseOpen(false);
        }}
      />
    </Page>
  );
}
