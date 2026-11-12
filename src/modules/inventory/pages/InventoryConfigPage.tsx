import { formatearReferenciaDocumento } from '../lib/documentReference';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Page,
  PageHeader,
  Button,
  Badge,
  Card,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import {
  Settings,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Calculator,
  ArrowRight,
  ShieldCheck,
  Building2,
  HelpCircle,
  Database,
  Search,
} from 'lucide-react';
import { inventoryApi } from '../services/inventoryApi';
import { type KardexLedgerResponse } from '../types/inventory.types';

function extractCostingErrorMessage(error: unknown): string {
  const err = error as {
    response?: { status?: number; data?: { message?: string | string[] } };
    message?: string;
  };
  const status = err?.response?.status;
  if (status === 404) {
    return 'El backend de producción aún no tiene desplegado el endpoint de configuración de costeo (/api/v1/inventory/kardex/config). Debes desplegar la rama dev en el backend y aplicar las migraciones.';
  }
  if (status === 429) {
    return 'El servidor respondió 429 (demasiadas peticiones temporales). Espera unos segundos y vuelve a intentar.';
  }
  const serverMsg = err?.response?.data?.message;
  if (Array.isArray(serverMsg)) return serverMsg.join(', ');
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
  return err?.message || 'Error al comunicarse con el servidor de costeo.';
}

export default function InventoryConfigPage() {
  const queryClient = useQueryClient();

  // 1. Obtener la configuración actual de costeo
  const {
    data: costConfig,
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    error: configError,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['inventory-cost-config'],
    queryFn: () => inventoryApi.getCostConfig(),
  });

  // 2. Obtener lista de productos para el visor de cálculo en vivo
  const { data: stockData } = useQuery({
    queryKey: ['inventory-stocks-for-config'],
    queryFn: () => inventoryApi.getStockBalances(),
  });

  const [selectedMethodOverride, setSelectedMethod] = useState<'PROMEDIO' | 'FIFO' | null>(null);
  const selectedMethod: 'PROMEDIO' | 'FIFO' =
    selectedMethodOverride ?? costConfig?.currentMethod ?? 'PROMEDIO';
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [methodFeedback, setMethodFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [recalcSummary, setRecalcSummary] = useState<{
    success: boolean;
    method: 'PROMEDIO' | 'FIFO';
    productsCount: number;
    movementsCount: number;
    previousValuationPen: number;
    newValuationPen: number;
    differencePen: number;
    recalculatedAt: string;
  } | null>(null);

  // Selector de producto para trazabilidad en vivo
  const [selectedSkuOverride, setSelectedSku] = useState<string>('');
  const selectedSku = selectedSkuOverride || stockData?.balances?.[0]?.sku || '';
  const [skuSearch, setSkuSearch] = useState<string>('');

  // Simulador What-If
  const [simInitialStock, setSimInitialStock] = useState<number>(100);
  const [simInitialCost, setSimInitialCost] = useState<number>(20);
  const [simEntryQty, setSimEntryQty] = useState<number>(50);
  const [simEntryCost, setSimEntryCost] = useState<number>(32);
  const [simExitQty, setSimExitQty] = useState<number>(60);

  // Consulta del Kardex del producto seleccionado
  const {
    data: productKardex,
    isLoading: isLoadingKardex,
    refetch: refetchProductKardex,
  } = useQuery<KardexLedgerResponse>({
    queryKey: ['product-kardex-config', selectedSku, selectedMethod],
    queryFn: () => inventoryApi.getKardexBySku(selectedSku, { metodo: selectedMethod }),
    enabled: Boolean(selectedSku),
  });

  // Mutación para guardar el método de valuación
  const saveMethodMutation = useMutation({
    mutationFn: (method: 'PROMEDIO' | 'FIFO') => inventoryApi.updateCostMethod(method),
    onMutate: () => {
      setMethodFeedback(null);
    },
    onSuccess: (data, method) => {
      queryClient.setQueryData(
        ['inventory-cost-config'],
        (prev: { currentMethod?: 'PROMEDIO' | 'FIFO' } | undefined) =>
          prev ? { ...prev, currentMethod: method } : prev,
      );
      setSelectedMethod(null);
      queryClient.invalidateQueries({ queryKey: ['inventory-cost-config'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stocks'] });
      queryClient.invalidateQueries({ queryKey: ['product-kardex-config'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setMethodFeedback({
        type: 'success',
        text: data?.message || `Método actualizado a ${method}.`,
      });
    },
    onError: (err) => {
      setMethodFeedback({
        type: 'error',
        text: extractCostingErrorMessage(err),
      });
    },
  });

  // Mutación para ejecutar el recálculo integral
  const recalculateMutation = useMutation({
    mutationFn: (method: 'PROMEDIO' | 'FIFO') => inventoryApi.recalculateCosting(method),
    onMutate: () => {
      setMethodFeedback(null);
    },
    onSuccess: (data) => {
      setRecalcSummary(data);
      setShowConfirmModal(false);
      queryClient.invalidateQueries({ queryKey: ['inventory-cost-config'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stocks'] });
      queryClient.invalidateQueries({ queryKey: ['product-kardex-config'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    },
    onError: (err) => {
      setShowConfirmModal(false);
      setMethodFeedback({
        type: 'error',
        text: extractCostingErrorMessage(err),
      });
    },
  });

  const handleSaveMethod = () => {
    saveMethodMutation.mutate(selectedMethod);
  };

  const handleExecuteRecalculation = () => {
    recalculateMutation.mutate(selectedMethod);
  };

  // Cálculos del simulador What-If
  // 1. Promedio
  const simInitialTotal = simInitialStock * simInitialCost;
  const simEntryTotal = simEntryQty * simEntryCost;
  const simTotalStockPostEntry = simInitialStock + simEntryQty;
  const simAvgCostPostEntry =
    simTotalStockPostEntry > 0 ? (simInitialTotal + simEntryTotal) / simTotalStockPostEntry : 0;
  const simExitCostPromedio = simExitQty * simAvgCostPostEntry;
  const simFinalStockPromedio = Math.max(0, simTotalStockPostEntry - simExitQty);
  const simFinalValuationPromedio = simFinalStockPromedio * simAvgCostPostEntry;

  // 2. FIFO
  // Capa 1: simInitialStock @ simInitialCost
  // Capa 2: simEntryQty @ simEntryCost
  const simFifoConsumedL1 = Math.min(simExitQty, simInitialStock);
  const simFifoConsumedL2 = Math.min(Math.max(0, simExitQty - simInitialStock), simEntryQty);
  const simExitCostFifo = simFifoConsumedL1 * simInitialCost + simFifoConsumedL2 * simEntryCost;
  const simFifoRemL1 = simInitialStock - simFifoConsumedL1;
  const simFifoRemL2 = simEntryQty - simFifoConsumedL2;
  const simFinalValuationFifo = simFifoRemL1 * simInitialCost + simFifoRemL2 * simEntryCost;

  return (
    <Page>
      <PageHeader
        title="Configuración de Costeo y Motor de Valuación"
        description="Reglas contables según NIC 2 y Art. 35 LIR, selección del método de valuación y recálculo integral"
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/60 flex items-center gap-1.5 py-1 px-2.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            SUNAT Art. 35 LIR
          </Badge>
          <Badge variant="outline" className="bg-blue-950/40 text-blue-400 border-blue-800/60 flex items-center gap-1.5 py-1 px-2.5">
            <BookOpen className="h-3.5 w-3.5" />
            NIC 2 Inventarios
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchConfig();
              refetchProductKardex();
            }}
            disabled={isLoadingConfig}
            className="border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoadingConfig ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-zinc-900/70 border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Método de Valuación Activo</span>
            <Database className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            {costConfig?.currentMethod === 'FIFO' ? 'PEPS (FIFO)' : 'Promedio Ponderado'}
            <Badge className={costConfig?.currentMethod === 'FIFO' ? 'bg-indigo-900/80 text-indigo-300 text-[10px]' : 'bg-emerald-900/80 text-emerald-300 text-[10px]'}>
              Vigente
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Empresa: <span className="text-zinc-300 font-medium">{costConfig?.companyName ? `${costConfig.companyName} (${costConfig.companyRuc})` : (costConfig?.companyRuc || 'Empresa activa')}</span>
          </p>
        </Card>

        <Card className="p-4 bg-zinc-900/70 border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Valorización Total Inventario</span>
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-300 font-mono">
            S/ {(costConfig?.totalInventoryValuePen ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Suma de saldos valorizados multialmacén
          </p>
        </Card>

        <Card className="p-4 bg-zinc-900/70 border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Catálogo de Productos</span>
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-zinc-100">
            {costConfig?.productsCount ?? 0} ítems
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {costConfig?.warehousesCount ?? 1} almacén(es) registrados
          </p>
        </Card>

        <Card className="p-4 bg-zinc-900/70 border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Movimientos en Kardex</span>
            <Calculator className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-zinc-100">
            {costConfig?.movementsCount ?? 0} registros
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Trazabilidad histórica completa
          </p>
        </Card>
      </div>

      {/* Alerta si la API de costeo no respondió o está desactualizada en producción */}
      {isErrorConfig && (
        <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-rose-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs space-y-1">
            <h4 className="font-semibold text-rose-300 text-sm">
              No se pudo cargar la configuración de costeo desde el servidor
            </h4>
            <p className="text-rose-200/90 leading-relaxed">
              {extractCostingErrorMessage(configError)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchConfig()}
            className="border-rose-700 bg-rose-950/50 text-rose-200 hover:bg-rose-900/50 h-7 text-xs shrink-0"
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Feedback explícito al guardar método o detectar error en operación */}
      {methodFeedback && (
        <div
          className={`mb-6 rounded-xl border p-4 flex items-start gap-3 text-xs ${
            methodFeedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
              : 'border-rose-500/40 bg-rose-950/20 text-rose-200'
          }`}
        >
          {methodFeedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <strong className="block font-semibold text-sm mb-0.5">
              {methodFeedback.type === 'success'
                ? 'Configuración de Costeo Actualizada'
                : 'No se pudo completar la operación'}
            </strong>
            <span>{methodFeedback.text}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMethodFeedback(null)}
            className="h-7 text-xs opacity-80 hover:opacity-100"
          >
            Cerrar
          </Button>
        </div>
      )}

      {/* Banner de Resultado de Recálculo si se acaba de ejecutar */}
      {recalcSummary && (
        <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 text-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-emerald-300 text-sm">
                ¡Recálculo de Costeo Integral Ejecutado Exitosamente!
              </h4>
              <p className="text-xs text-emerald-300/80 mt-1">
                Se recomputaron cronológicamente todos los movimientos bajo el método{' '}
                <strong className="text-emerald-200">
                  {recalcSummary.method === 'FIFO' ? 'PEPS (FIFO)' : 'Promedio Ponderado Móvil'}
                </strong>.
              </p>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/50 p-2">
                  <span className="text-emerald-400 block text-[11px]">Productos Procesados</span>
                  <span className="font-bold text-white text-sm">{recalcSummary.productsCount}</span>
                </div>
                <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/50 p-2">
                  <span className="text-emerald-400 block text-[11px]">Movimientos Recalculados</span>
                  <span className="font-bold text-white text-sm">{recalcSummary.movementsCount}</span>
                </div>
                <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/50 p-2">
                  <span className="text-emerald-400 block text-[11px]">Valuación Anterior</span>
                  <span className="font-mono text-white text-sm">S/ {recalcSummary.previousValuationPen.toFixed(2)}</span>
                </div>
                <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/50 p-2">
                  <span className="text-emerald-400 block text-[11px]">Nueva Valuación (Variación)</span>
                  <span className="font-mono font-bold text-white text-sm">
                    S/ {recalcSummary.newValuationPen.toFixed(2)}{' '}
                    <span className={recalcSummary.differencePen >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      ({recalcSummary.differencePen >= 0 ? '+' : ''}{recalcSummary.differencePen.toFixed(2)})
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRecalcSummary(null)}
              className="text-emerald-400 hover:text-emerald-200 h-7 text-xs"
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Sección 1: Selección de Método y Botón de Recálculo (Obs 21 & 22) */}
      <Card className="p-6 bg-zinc-900/80 border-zinc-800 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800 mb-6">
          <div>
            <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-400" />
              Selección de Método de Valuación y Recálculo de Costeo
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Cumplimiento del Art. 35 del Reglamento de la Ley del Impuesto a la Renta (Inciso a y b) y NIC 2 Inventarios
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSaveMethod}
              disabled={saveMethodMutation.isPending || selectedMethod === costConfig?.currentMethod}
              className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              {saveMethodMutation.isPending ? 'Guardando...' : 'Guardar Método'}
            </Button>
            <Button
              onClick={() => setShowConfirmModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-950/40"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Ejecutar Recálculo de Costeo
            </Button>
          </div>
        </div>

        {/* Tarjetas de Selección de Método */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opción 1: Promedio Ponderado */}
          <div
            onClick={() => setSelectedMethod('PROMEDIO')}
            className={`p-5 rounded-xl border cursor-pointer transition-all ${
              selectedMethod === 'PROMEDIO'
                ? 'border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/50'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    selectedMethod === 'PROMEDIO'
                      ? 'border-emerald-400 bg-emerald-500'
                      : 'border-zinc-600'
                  }`}
                >
                  {selectedMethod === 'PROMEDIO' && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm">
                    Costo Promedio Ponderado Móvil
                  </h4>
                  <Badge variant="outline" className="mt-1 bg-emerald-950/40 text-emerald-400 border-emerald-800 text-[10px]">
                    Recomendado SUNAT / NIC 2 p. 25
                  </Badge>
                </div>
              </div>
              <Badge className="bg-zinc-800 text-zinc-300 text-[10px]">Art. 35 Inc. a LIR</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
              Cada compra u orden de importación recibida recalcula el costo unitario promedio del almacén. Las salidas
              (ventas, mermas, robos o traslados) se liquidan al costo promedio vigente sin alterar el costo unitario remanente.
            </p>
            <div className="mt-3 text-[11px] font-mono text-zinc-400 bg-zinc-950/60 p-2 rounded border border-zinc-800/80">
              Costo = (Valor Previo + Costo Entrada) / (Stock Previo + Cantidad Entrada)
            </div>
          </div>

          {/* Opción 2: FIFO / PEPS */}
          <div
            onClick={() => setSelectedMethod('FIFO')}
            className={`p-5 rounded-xl border cursor-pointer transition-all ${
              selectedMethod === 'FIFO'
                ? 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500/50'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    selectedMethod === 'FIFO'
                      ? 'border-indigo-400 bg-indigo-500'
                      : 'border-zinc-600'
                  }`}
                >
                  {selectedMethod === 'FIFO' && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-100 text-sm">
                    Primeras Entradas, Primeras Salidas (PEPS / FIFO)
                  </h4>
                  <Badge variant="outline" className="mt-1 bg-indigo-950/40 text-indigo-400 border-indigo-800 text-[10px]">
                    Capas Cronológicas / NIC 2 p. 25
                  </Badge>
                </div>
              </div>
              <Badge className="bg-zinc-800 text-zinc-300 text-[10px]">Art. 35 Inc. b LIR</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
              Conserva el historial en capas cronológicas de costo. Las salidas consumen primero las existencias de mayor
              antigüedad. El inventario final queda valuado a los precios de compra más recientes.
            </p>
            <div className="mt-3 text-[11px] font-mono text-zinc-400 bg-zinc-950/60 p-2 rounded border border-zinc-800/80">
              Costo Salida = ∑ (Capa_i_consumida × Costo_Capa_i)
            </div>
          </div>
        </div>

        {/* Alerta explicativa sobre recálculo */}
        <div className="mt-5 p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 flex items-start gap-3 text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <strong className="text-amber-300 block font-medium">
              ¿Por qué y cuándo debe ejecutarse el recálculo de costeo?
            </strong>
            <p className="text-amber-200/90 leading-relaxed">
              Cuando se realiza un <strong>ajuste de toma física</strong>, ocurre una <strong>merma tributaria</strong>, o hubo
              un <strong>robo/siniestro extraordinario</strong>, las cantidades físicas cambian. Si no se recalcula el costeo
              desde el saldo inicial o desde el punto de ajuste, el valor monetario en libros difiere de la realidad contable.
              Asimismo, si la empresa cambia de método (ej. de FIFO a Promedio), el recálculo integral garantiza que todo el
              Kardex valorizado guarde coherencia aritmética perfecta.
            </p>
          </div>
        </div>
      </Card>

      {/* Sección 2: Explicación de Cálculos Matemáticos y Visualización */}
      <Card className="p-6 bg-zinc-900/80 border-zinc-800">
        <div className="mb-6">
          <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            Desglose Matemático y Demostración de Cálculos
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Visualización transparente de cómo se aplican las fórmulas en el Kardex Valorizado general y por producto
          </p>
        </div>

        <Tabs defaultValue="promedio" className="w-full">
          <TabsList className="bg-zinc-950 border border-zinc-800 mb-6">
            <TabsTrigger value="promedio" className="data-[state=active]:bg-zinc-800 text-xs">
              1. Promedio Ponderado Móvil
            </TabsTrigger>
            <TabsTrigger value="fifo" className="data-[state=active]:bg-zinc-800 text-xs">
              2. Método FIFO / PEPS
            </TabsTrigger>
            <TabsTrigger value="producto" className="data-[state=active]:bg-zinc-800 text-xs">
              3. Trazabilidad en Vivo por Producto
            </TabsTrigger>
            <TabsTrigger value="simulador" className="data-[state=active]:bg-zinc-800 text-xs">
              4. Simulador What-If Interactivo
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Promedio Ponderado Móvil */}
          <TabsContent value="promedio" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  A. Entrada de Mercadería (Compras / Importaciones / Devoluciones)
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Cuando ingresan existencias con un nuevo costo unitario, se recalcula el costo promedio ponderado de todo
                  el inventario remanente:
                </p>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-200">
                  <div className="text-emerald-400 font-bold mb-1">Fórmula de Costo Unitario Promedio:</div>
                  Costo_Promedio = (Valor_Previo + Costo_Total_Entrada) / (Stock_Previo + Cantidad_Entrada)
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-200">
                  <div className="text-cyan-400 font-bold mb-1">Fórmula de Valor Total Resultante:</div>
                  Valor_Resultante = Stock_Resultante × Costo_Promedio
                </div>
              </div>

              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  B. Salida de Mercadería (Ventas / Mermas / Robos / Ajustes)
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Las salidas se valorizan estrictamente al <strong>costo promedio vigente</strong> en el momento del movimiento.
                  El costo unitario promedio resultante <strong>NO se modifica</strong>:
                </p>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-200">
                  <div className="text-blue-400 font-bold mb-1">Costo de Salida Contable:</div>
                  Costo_Salida = Cantidad_Salida × Costo_Promedio_Vigente
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-200">
                  <div className="text-amber-400 font-bold mb-1">Ajuste por Merma o Robo:</div>
                  Valor_Final = (Stock_Previo - Cantidad_Merma) × Costo_Promedio_Vigente
                </div>
              </div>
            </div>

            {/* Ejemplo Numérico Práctico */}
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
              <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Ejemplo Numérico Didáctico Paso a Paso
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 font-medium">
                    <tr>
                      <th className="p-2.5">Operación</th>
                      <th className="p-2.5">Descripción</th>
                      <th className="p-2.5 text-right">Cant. Mov.</th>
                      <th className="p-2.5 text-right">Costo Unit. Mov.</th>
                      <th className="p-2.5 text-right">Stock Saldo</th>
                      <th className="p-2.5 text-right">Costo Promedio Saldo</th>
                      <th className="p-2.5 text-right">Valor Total Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                    <tr>
                      <td className="p-2.5 text-emerald-400">16 Saldo Inicial</td>
                      <td className="p-2.5 font-sans">Inventario de apertura</td>
                      <td className="p-2.5 text-right text-emerald-400">+100</td>
                      <td className="p-2.5 text-right">S/ 10.00</td>
                      <td className="p-2.5 text-right font-bold text-white">100</td>
                      <td className="p-2.5 text-right text-cyan-300 font-bold">S/ 10.00</td>
                      <td className="p-2.5 text-right font-bold text-white">S/ 1,000.00</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-emerald-400">02 Compra Nac.</td>
                      <td className="p-2.5 font-sans">Nueva compra con alza de precio</td>
                      <td className="p-2.5 text-right text-emerald-400">+100</td>
                      <td className="p-2.5 text-right">S/ 20.00</td>
                      <td className="p-2.5 text-right font-bold text-white">200</td>
                      <td className="p-2.5 text-right text-cyan-300 font-bold">S/ 15.00</td>
                      <td className="p-2.5 text-right font-bold text-white">S/ 3,000.00</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-rose-400">01 Venta</td>
                      <td className="p-2.5 font-sans">Factura F001-00042</td>
                      <td className="p-2.5 text-right text-rose-400">-50</td>
                      <td className="p-2.5 text-right">S/ 15.00</td>
                      <td className="p-2.5 text-right font-bold text-white">150</td>
                      <td className="p-2.5 text-right text-cyan-300 font-bold">S/ 15.00</td>
                      <td className="p-2.5 text-right font-bold text-white">S/ 2,250.00</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-amber-400">28 Ajuste Físico</td>
                      <td className="p-2.5 font-sans">Merma / Pérdida por robo comprobado</td>
                      <td className="p-2.5 text-right text-amber-400">-10</td>
                      <td className="p-2.5 text-right">S/ 15.00</td>
                      <td className="p-2.5 text-right font-bold text-white">140</td>
                      <td className="p-2.5 text-right text-cyan-300 font-bold">S/ 15.00</td>
                      <td className="p-2.5 text-right font-bold text-white">S/ 2,100.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Método FIFO / PEPS */}
          <TabsContent value="fifo" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                <h4 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Estructura de Capas de Costeo (FIFO Queue)
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Cada entrada genera una nueva capa identificada con fecha, cantidad remanente y costo unitario de adquisición:
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2 rounded bg-indigo-950/40 border border-indigo-800/60 text-indigo-200">
                    Capa 1 (01/11/2026): 100 unidades @ S/ 10.00 = S/ 1,000.00
                  </div>
                  <div className="p-2 rounded bg-indigo-950/40 border border-indigo-800/60 text-indigo-200">
                    Capa 2 (05/11/2026): 100 unidades @ S/ 20.00 = S/ 2,000.00
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                <h4 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Mecánica de Consumo de Capas
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Si se emite una venta por <strong>130 unidades</strong>, el motor consume:
                </p>
                <ul className="text-xs space-y-1.5 text-zinc-300 list-disc list-inside">
                  <li><strong>100 unidades</strong> de la Capa 1 @ S/ 10.00 = <span className="font-mono text-purple-300">S/ 1,000.00</span></li>
                  <li><strong>30 unidades</strong> de la Capa 2 @ S/ 20.00 = <span className="font-mono text-purple-300">S/ 600.00</span></li>
                  <li><strong>Costo de Ventas Total:</strong> <span className="font-mono font-bold text-white">S/ 1,600.00</span> (Promedio = S/ 12.3077)</li>
                  <li><strong>Saldo Remanente:</strong> 70 unidades en Capa 2 @ S/ 20.00 = <span className="font-mono text-emerald-400">S/ 1,400.00</span></li>
                </ul>
              </div>
            </div>

            {/* Cuadro Comparativo Financiero / Tributario */}
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40">
              <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                Comparativa Tributaria y Financiera (NIC 2 vs Art. 35 LIR)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="p-2.5">Criterio Contable</th>
                      <th className="p-2.5">Promedio Ponderado Móvil</th>
                      <th className="p-2.5">PEPS / FIFO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    <tr>
                      <td className="p-2.5 font-medium text-white">En entorno inflacionario</td>
                      <td className="p-2.5">Costo de ventas balanceado, utilidad media</td>
                      <td className="p-2.5 text-amber-300">Menor costo de ventas, mayor utilidad e impuesto</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium text-white">Valuación del inventario final</td>
                      <td className="p-2.5">Promedio de los costos históricos recientes</td>
                      <td className="p-2.5 text-emerald-400">Valuado a los precios de compra más actuales</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium text-white">Facilidad y auditoría SUNAT</td>
                      <td className="p-2.5 text-emerald-400">Máxima sencillez de fiscalización (Art. 35 LIR)</td>
                      <td className="p-2.5">Requiere control minucioso de lotes y capas</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Trazabilidad en Vivo por Producto (Obs 23) */}
          <TabsContent value="producto" className="space-y-6">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:w-96">
                <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
                  Seleccionar Producto del Catálogo:
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-2.5" />
                  <Input
                    placeholder="Filtrar por SKU o descripción..."
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    className="pl-9 bg-zinc-900 border-zinc-800 text-xs h-9"
                  />
                </div>
              </div>

              {/* Botones de SKU rápido */}
              <div className="flex-1 overflow-x-auto flex items-center gap-2 py-1">
                {stockData?.balances
                  ?.filter((b) =>
                    skuSearch
                      ? b.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
                        b.description.toLowerCase().includes(skuSearch.toLowerCase())
                      : true
                  )
                  .slice(0, 5)
                  .map((b) => (
                    <Button
                      key={b.sku}
                      size="sm"
                      variant={selectedSku === b.sku ? 'default' : 'outline'}
                      onClick={() => setSelectedSku(b.sku)}
                      className={`text-xs h-8 whitespace-nowrap ${
                        selectedSku === b.sku
                          ? 'bg-indigo-600 text-white'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      {b.sku}
                    </Button>
                  ))}
              </div>
            </div>

            {/* Detalle del Kardex del producto seleccionado */}
            {isLoadingKardex ? (
              <div className="p-8 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                Cargando trazabilidad matemática del producto...
              </div>
            ) : productKardex ? (
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/40">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                  <div>
                    <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                      <span className="font-mono text-indigo-400">{productKardex.product.sku}</span>
                      <span className="text-zinc-400 font-normal">—</span>
                      <span>{productKardex.product.description}</span>
                    </h4>
                    <span className="text-xs text-zinc-400">
                      Unidad: <strong className="text-zinc-200">{productKardex.product.sunatUnitCode}</strong> | Método:{' '}
                      <strong className="text-indigo-300">{productKardex.costMethod || selectedMethod}</strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-400 block">Saldo Actual Valorado:</span>
                    <span className="text-sm font-mono font-bold text-emerald-400">
                      {productKardex.summary?.totalStock ?? 0} {productKardex.product.sunatUnitCode} @ S/{' '}
                      {(productKardex.summary?.averageCost ?? 0).toFixed(4)} = S/{' '}
                      {(productKardex.summary?.totalValuation ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 font-medium">
                      <tr>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Comprobante</th>
                        <th className="p-2">Operación</th>
                        <th className="p-2 text-right text-emerald-400">Entrada (Cant / Costo)</th>
                        <th className="p-2 text-right text-rose-400">Salida (Cant / Costo)</th>
                        <th className="p-2 text-right text-cyan-300">Saldo Resultante (Cant / Costo / Total)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                      {productKardex.movements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-zinc-500 font-sans">
                            No registra movimientos de Kardex para este producto.
                          </td>
                        </tr>
                      ) : (
                        productKardex.movements.map((m) => (
                          <tr key={m.id} className="hover:bg-zinc-900/50">
                            <td className="p-2 text-zinc-400">{new Date(m.movementDate).toLocaleDateString()}</td>
                            <td className="p-2 font-sans">
                              {m.documentTypeCode ? `${m.documentTypeCode} ${formatearReferenciaDocumento(m.documentSerial, m.documentNumber)}` : '—'}
                            </td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-[10px] bg-zinc-900 border-zinc-800">
                                {m.operationTypeCode}
                              </Badge>
                            </td>
                            <td className="p-2 text-right text-emerald-400">
                              {m.direction === 'ENTRADA' ? `+${m.quantity} @ S/ ${m.unitCost.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2 text-right text-rose-400">
                              {m.direction === 'SALIDA' ? `-${m.quantity} @ S/ ${m.unitCost.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2 text-right font-bold text-white">
                              {m.resultingStock} u @ S/ {m.resultingAverageCost.toFixed(2)} ={' '}
                              <span className="text-cyan-400">S/ {m.resultingTotalValue.toFixed(2)}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </TabsContent>

          {/* Tab 4: Simulador What-If */}
          <TabsContent value="simulador" className="space-y-6">
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/60">
              <h4 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-cyan-400" />
                Simulador Comparativo en Tiempo Real (What-If)
              </h4>
              <p className="text-xs text-zinc-400 mb-4">
                Pruebe valores para ver cómo reacciona cada método ante entradas sucesivas y salidas o mermas:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Stock Inicial:</label>
                  <Input
                    type="number"
                    value={simInitialStock}
                    onChange={(e) => setSimInitialStock(Math.max(0, Number(e.target.value)))}
                    className="h-8 bg-zinc-900 border-zinc-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Costo Unit. Inicial (S/):</label>
                  <Input
                    type="number"
                    value={simInitialCost}
                    onChange={(e) => setSimInitialCost(Math.max(0, Number(e.target.value)))}
                    className="h-8 bg-zinc-900 border-zinc-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Cant. Nueva Entrada:</label>
                  <Input
                    type="number"
                    value={simEntryQty}
                    onChange={(e) => setSimEntryQty(Math.max(0, Number(e.target.value)))}
                    className="h-8 bg-zinc-900 border-zinc-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Costo Nueva Entrada (S/):</label>
                  <Input
                    type="number"
                    value={simEntryCost}
                    onChange={(e) => setSimEntryCost(Math.max(0, Number(e.target.value)))}
                    className="h-8 bg-zinc-900 border-zinc-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Cant. Salida / Merma:</label>
                  <Input
                    type="number"
                    value={simExitQty}
                    onChange={(e) => setSimExitQty(Math.max(0, Number(e.target.value)))}
                    className="h-8 bg-zinc-900 border-zinc-800 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Resultados Lado a Lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40 space-y-2">
                  <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    Resultado en Promedio Ponderado Móvil
                  </h5>
                  <div className="text-xs space-y-1 font-mono text-zinc-300">
                    <div>Costo Promedio tras Compra: <strong className="text-white">S/ {simAvgCostPostEntry.toFixed(4)}</strong></div>
                    <div>Costo Total de Salida: <strong className="text-rose-400">S/ {simExitCostPromedio.toFixed(2)}</strong></div>
                    <div>Stock Final: <strong className="text-white">{simFinalStockPromedio} u</strong></div>
                    <div>Valuación Final Inventario: <strong className="text-emerald-400">S/ {simFinalValuationPromedio.toFixed(2)}</strong></div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-indigo-950/20 border border-indigo-800/40 space-y-2">
                  <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
                    Resultado en PEPS / FIFO
                  </h5>
                  <div className="text-xs space-y-1 font-mono text-zinc-300">
                    <div>Consumo Capa Inicial (S/ {simInitialCost}): <strong className="text-white">{simFifoConsumedL1} u</strong></div>
                    <div>Consumo Capa Entrada (S/ {simEntryCost}): <strong className="text-white">{simFifoConsumedL2} u</strong></div>
                    <div>Costo Total de Salida: <strong className="text-rose-400">S/ {simExitCostFifo.toFixed(2)}</strong></div>
                    <div>Valuación Final Inventario: <strong className="text-indigo-400">S/ {simFinalValuationFifo.toFixed(2)}</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Modal de Confirmación de Recálculo Integral */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Recálculo de Costeo Integral
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-zinc-300 space-y-3 py-2 leading-relaxed">
            <p>
              Está a punto de ejecutar un <strong>recálculo integral de Kardex</strong> para la empresa{' '}
              <strong className="text-white">{costConfig?.companyName || costConfig?.companyRuc}</strong>{' '}
              bajo el método{' '}
              <strong className="text-indigo-300">
                {selectedMethod === 'FIFO' ? 'PEPS (FIFO)' : 'Costo Promedio Ponderado Móvil'}
              </strong>.
            </p>
            <p className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
              Esta operación es idempotente y segura: reproducirá cronológicamente cada compra, venta, ajuste de toma
              física y nota de débito, actualizando costos unitarios, capas y saldos contables en la base de datos.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmModal(false)}
              className="border-zinc-700 bg-zinc-800 text-zinc-300"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteRecalculation}
              disabled={recalculateMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {recalculateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Procesando Kardex...
                </>
              ) : (
                'Confirmar y Recalcular'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}