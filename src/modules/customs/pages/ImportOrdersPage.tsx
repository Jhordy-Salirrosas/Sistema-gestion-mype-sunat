import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader, Button, Card, Badge, Input } from '@/components/ui';
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Ship,
  Clock,
  Globe,
  CheckCircle2,
  ChevronRight,
  Layers,
  FileCheck,
  ShieldCheck,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import {
  importOrdersApi,
  type ImportOrderRecord,
  type StageChecklistItem,
  type AddOrderDocumentPayload,
} from '../services/importOrdersApi';
import { NewImportOrderModal } from '../components/NewImportOrderModal';
import { AddOrderDocumentModal } from '../components/AddOrderDocumentModal';
import { OrderChecklistTab } from '../components/OrderChecklistTab';
import { GoodsReceiptModal } from '../components/GoodsReceiptModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const STAGES = [
  'Solicitud',
  'Aprobación / OC',
  'Proforma',
  'Embarque',
  'Tránsito',
  'Arribo',
  'Almacén Aduanero',
  'DAM',
  'Canal',
  'Tributos',
  'Levante',
  'Retiro',
  'Recepción',
  'Costeo',
];

export default function ImportOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ImportOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Orden seleccionada para inspección 360°
  const [selectedOrder, setSelectedOrder] = useState<ImportOrderRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'CHECKLIST' | 'ITEMS' | 'ACCOUNTING' | 'TIMELINE'>('CHECKLIST');
  const [checklist, setChecklist] = useState<StageChecklistItem[]>([]);
  const [isChecklistLoading, setIsChecklistLoading] = useState(false);

  // Modal para avanzar de etapa
  const [selectedOrderForAdvance, setSelectedOrderForAdvance] = useState<ImportOrderRecord | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [advanceDocUrl, setAdvanceDocUrl] = useState('');
  const [advanceDocNumber, setAdvanceDocNumber] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Modal de adjuntar documento
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [docModalStageIndex, setDocModalStageIndex] = useState<number | undefined>(undefined);

  // Modal de recepción en almacén
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Estado de generación de expediente
  const [isGeneratingShipment, setIsGeneratingShipment] = useState(false);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await importOrdersApi.listOrders();
      const items = data.items || [];
      setOrders(items);
      if (selectedOrder) {
        const refreshed = items.find((o) => o.id === selectedOrder.id);
        if (refreshed) {
          setSelectedOrder(refreshed);
          loadChecklist(refreshed.id);
        }
      } else if (items.length > 0) {
        setSelectedOrder(items[0]);
        loadChecklist(items[0].id);
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChecklist = async (orderId: string) => {
    setIsChecklistLoading(true);
    try {
      const data = await importOrdersApi.getChecklist(orderId);
      setChecklist(data || []);
    } catch {
      setChecklist([]);
    } finally {
      setIsChecklistLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleSelectOrder = (order: ImportOrderRecord) => {
    setSelectedOrder(order);
    loadChecklist(order.id);
  };

  const handleAdvanceStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForAdvance) return;

    const currentIdx = selectedOrderForAdvance.currentStageIndex;
    const nextIdx = currentIdx + 1;
    if (nextIdx >= STAGES.length) return;

    setIsAdvancing(true);
    try {
      await importOrdersApi.advanceStage(selectedOrderForAdvance.id, {
        nextStageIndex: nextIdx,
        stageName: STAGES[nextIdx],
        userName: 'Operador Comercio Exterior',
        evidenceNotes: evidenceNotes.trim() || undefined,
        documentUrl: advanceDocUrl.trim() || undefined,
        documentNumber: advanceDocNumber.trim() || undefined,
      });
      setSelectedOrderForAdvance(null);
      setEvidenceNotes('');
      setAdvanceDocUrl('');
      setAdvanceDocNumber('');
      await loadOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al avanzar de etapa.');
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleGenerateShipment = async (order: ImportOrderRecord) => {
    setIsGeneratingShipment(true);
    try {
      await importOrdersApi.generateShipment(order.id, {
        originCountryCode: order.supplierCountry,
        destinationCustoms: '118',
        etaDate: order.expectedArrivalDate || undefined,
      });
      await loadOrders();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Error al generar expediente aduanero.');
    } finally {
      setIsGeneratingShipment(false);
    }
  };

  const handleAddDocument = async (payload: AddOrderDocumentPayload) => {
    if (!selectedOrder) return;
    await importOrdersApi.addDocument(selectedOrder.id, payload);
    await loadChecklist(selectedOrder.id);
    await loadOrders();
  };

  const openAddDocModal = (stageIndex?: number) => {
    setDocModalStageIndex(stageIndex);
    setIsAddDocOpen(true);
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const itemsForReceipt = selectedOrder
    ? (selectedOrder.items || []).map((it) => ({
        id: it.id,
        productCode: it.productCode || it.hsCode || 'PROD',
        commercialDescription: it.description || 'Mercancía importada',
        quantity: it.quantity,
        unitCode: it.unitCode || 'NIU',
        destinationType: 'MERCADERIA' as const,
      }))
    : [];

  return (
    <Page>
      <PageHeader
        title="1. Pedidos al Exterior (Órdenes de Compra Internacionales)"
        description="Gestión comercial de proformas, cotizaciones y órdenes de compra con proveedores extranjeros (Incoterms 2020, multimoneda y costeo estimado)."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrders}
            disabled={isLoading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo Pedido al Exterior
          </Button>
        </div>
      </PageHeader>

      {/* Tracker del Ciclo de Vida del Pedido en 4 Etapas */}
      <Card className="p-3.5 bg-card border-border/80">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Ship className="h-3.5 w-3.5 text-primary" />
            Flujo del Pedido hacia Tránsito y Almacén
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Incoterms 2020 · Multimoneda · Sustento Documentario
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 rounded-full bg-primary text-primary-foreground items-center justify-center font-bold text-[10px]">1</span>
            <div>
              <p className="font-semibold text-foreground text-[11px]">Proforma y Cotización</p>
              <p className="text-[10px] text-muted-foreground">Pacto Incoterm y Moneda</p>
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 rounded-full bg-muted border items-center justify-center font-bold text-[10px]">2</span>
            <div>
              <p className="font-semibold text-foreground text-[11px]">Orden Confirmada</p>
              <p className="text-[10px] text-muted-foreground">Sustento comercial listo</p>
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 rounded-full bg-muted border items-center justify-center font-bold text-[10px]">3</span>
            <div>
              <p className="font-semibold text-foreground text-[11px]">Embarque y BL</p>
              <p className="text-[10px] text-muted-foreground">Traspaso al Paso 2</p>
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-border bg-muted/20 flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 rounded-full bg-muted border items-center justify-center font-bold text-[10px]">4</span>
            <div>
              <p className="font-semibold text-foreground text-[11px]">Almacén / Kardex</p>
              <p className="text-[10px] text-muted-foreground">Cta 2811 ➔ Cta 2011</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid Principal: Listado a la Izquierda y Panel 360° a la Derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Columna Izquierda (5/12): Listado de Órdenes */}
        <div className="lg:col-span-5 space-y-3">
          <Card className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por N° orden o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </Card>

          <div className="space-y-2">
            {isLoading ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                Cargando órdenes de importación...
              </Card>
            ) : filteredOrders.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                No hay órdenes de importación registradas.{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto text-xs font-semibold"
                  onClick={() => setIsNewModalOpen(true)}
                >
                  Crear primera orden.
                </Button>
              </Card>
            ) : (
              filteredOrders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <Card
                    key={ord.id}
                    onClick={() => handleSelectOrder(ord)}
                    className={`p-3.5 cursor-pointer transition-all hover:border-primary/50 ${
                      isSelected
                        ? 'border-primary ring-1 ring-primary/40 bg-primary/5'
                        : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-xs text-primary flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        {ord.orderNumber}
                      </span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                        {ord.status}
                      </Badge>
                    </div>

                    <div className="text-xs font-medium text-foreground truncate mb-1">
                      {ord.supplierName}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {ord.supplierCountry} • {ord.incoterm}
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {ord.currencyCode} {ord.totalFob.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px]">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Clock className="h-2.5 w-2.5" />
                        {ord.currentStageIndex + 1}. {ord.currentStage}
                      </span>

                      {ord.currentStageIndex < STAGES.length - 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderForAdvance(ord);
                          }}
                          className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                        >
                          Avanzar
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha (7/12): Detalle 360°, Checklist y Acciones Directas */}
        <div className="lg:col-span-7 space-y-4">
          {selectedOrder ? (
            <>
              {/* Cabecera Técnica de la Orden */}
              <Card className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold font-mono text-primary">
                        {selectedOrder.orderNumber}
                      </h2>
                      <Badge variant="outline" className="text-xs">
                        Incoterm {selectedOrder.incoterm} 2020
                      </Badge>
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]">
                        {selectedOrder.currentStage}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Proveedor: <span className="font-semibold text-foreground">{selectedOrder.supplierName}</span> ({selectedOrder.supplierCountry})
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {selectedOrder.currentStageIndex < STAGES.length - 1 && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedOrderForAdvance(selectedOrder)}
                        className="text-xs gap-1 h-8 bg-primary"
                      >
                        Avanzar Etapa
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Métricas Monetarias Clave */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/40">
                    <span className="text-[10px] text-muted-foreground uppercase">Valor FOB</span>
                    <p className="font-mono font-bold text-sm">
                      {selectedOrder.currencyCode} {selectedOrder.totalFob.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-muted/40">
                    <span className="text-[10px] text-muted-foreground uppercase">Flete Est.</span>
                    <p className="font-mono font-bold text-sm">
                      {selectedOrder.currencyCode} {selectedOrder.estimatedFreight.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-muted/40">
                    <span className="text-[10px] text-muted-foreground uppercase">Seguro Est.</span>
                    <p className="font-mono font-bold text-sm">
                      {selectedOrder.currencyCode} {selectedOrder.estimatedInsurance.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-muted/40">
                    <span className="text-[10px] text-muted-foreground uppercase">Total CIF Est.</span>
                    <p className="font-mono font-bold text-sm text-primary">
                      {selectedOrder.currencyCode} {selectedOrder.totalCif.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Barra de Acciones Guiadas del Flujo Oficial (4 Pasos) */}
                <div className="p-2.5 rounded-md bg-muted/20 border flex items-center justify-between gap-2 flex-wrap text-xs">
                  {selectedOrder.shipment ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Expediente de Tránsito Vinculado:
                        </span>
                        <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30">
                          {selectedOrder.shipment.shipment_number}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          · {selectedOrder.shipment.status || 'EN_TRANSITO'}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => navigate(`/customs/shipments/${selectedOrder.shipment?.id}`)}
                        className="text-xs h-7 gap-1 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                      >
                        <Ship className="h-3 w-3" />
                        Continuar a Tránsito y Arribo (Paso 2)
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Paso 1 Completado:
                        </span>
                        <span className="text-xs text-foreground/80">
                          Orden aprobada. Genere el expediente logístico para continuar al embarque.
                        </span>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleGenerateShipment(selectedOrder)}
                        disabled={isGeneratingShipment}
                        className="text-xs h-7 gap-1 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                      >
                        <Ship className="h-3 w-3" />
                        {isGeneratingShipment ? 'Generando...' : 'Generar Expediente de Tránsito (Paso 2)'}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>

              {/* Selector de Pestañas: Checklist, Ítems, Contabilidad PCGE, Historial */}
              <div className="flex items-center gap-2 border-b pb-2 text-xs flex-wrap">
                <Button
                  size="sm"
                  variant={activeTab === 'CHECKLIST' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('CHECKLIST')}
                  className="h-8 text-xs gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Checklist Documentario
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'ITEMS' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('ITEMS')}
                  className="h-8 text-xs gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Ítems de Compra ({selectedOrder.items?.length || 0})
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'ACCOUNTING' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('ACCOUNTING')}
                  className="h-8 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Mapeo Contable PCGE 2019
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'TIMELINE' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('TIMELINE')}
                  className="h-8 text-xs gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Historial de Etapas
                </Button>
              </div>

              {/* Contenido de la Pestaña Activa */}
              {activeTab === 'CHECKLIST' && (
                <OrderChecklistTab
                  order={selectedOrder}
                  checklist={checklist}
                  isLoading={isChecklistLoading}
                  onOpenAddDocModal={openAddDocModal}
                />
              )}

              {activeTab === 'ACCOUNTING' && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4 text-emerald-600" />
                        Asignación Contable PCGE 2019 de la Orden
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Tratamiento contable oficial de compras internacionales y costos vinculados (NIC 2).
                      </p>
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 font-mono text-[10px]">
                      PCGE 2019 Vigente
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                      <div className="font-semibold text-foreground flex items-center justify-between">
                        <span>1. Mercadería en Tránsito</span>
                        <span className="font-mono font-bold text-primary">Cta 2811</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Se debita por el valor de compra pactado con el proveedor internacional ({selectedOrder.currencyCode} {selectedOrder.totalFob.toFixed(2)}).
                      </p>
                      <div className="text-[11px] bg-background p-2 rounded border font-mono">
                        DEBE: 2811 Mercaderías manufacturadas en tránsito
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                      <div className="font-semibold text-foreground flex items-center justify-between">
                        <span>2. Proveedores del Exterior</span>
                        <span className="font-mono font-bold text-primary">Cta 4212</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Se acredita la obligación por pagar al proveedor {selectedOrder.supplierName} ({selectedOrder.supplierCountry}).
                      </p>
                      <div className="text-[11px] bg-background p-2 rounded border font-mono">
                        HABER: 4212 Facturas por pagar emitida en el exterior
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                      <div className="font-semibold text-foreground flex items-center justify-between">
                        <span>3. Flete y Seguro de Travesía</span>
                        <span className="font-mono font-bold text-primary">Cta 2812</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Flete ({selectedOrder.currencyCode} {selectedOrder.estimatedFreight.toFixed(2)}) y Seguro ({selectedOrder.currencyCode} {selectedOrder.estimatedInsurance.toFixed(2)}) integran el costo de importación (NIC 2).
                      </p>
                      <div className="text-[11px] bg-background p-2 rounded border font-mono">
                        DEBE: 2812 Costos de flete y seguro de importación
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                      <div className="font-semibold text-foreground flex items-center justify-between">
                        <span>4. Llegada a Almacén Central</span>
                        <span className="font-mono font-bold text-emerald-600">Cta 20111</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Al completar el recojo y liquidación Landed Cost en el Paso 4, se traslada el costo total al Kardex oficial con Operación 18.
                      </p>
                      <div className="text-[11px] bg-background p-2 rounded border font-mono">
                        DEBE: 20111 Mercaderías manufacturadas (Kardex PLE 13.1)
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {activeTab === 'ITEMS' && (
                <Card className="p-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40 uppercase text-muted-foreground text-[10px]">
                          <th className="p-2">SKU / Código</th>
                          <th className="p-2">Descripción</th>
                          <th className="p-2">Partida (SPN)</th>
                          <th className="p-2 text-right">Cantidad</th>
                          <th className="p-2 text-right">P. Unit FOB</th>
                          <th className="p-2 text-right">Total FOB</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(selectedOrder.items || []).map((it) => (
                          <tr key={it.id} className="hover:bg-muted/20">
                            <td className="p-2 font-mono font-medium">{it.productCode || '—'}</td>
                            <td className="p-2 font-medium">{it.description}</td>
                            <td className="p-2 font-mono text-muted-foreground">{it.hsCode || '—'}</td>
                            <td className="p-2 text-right font-mono">
                              {it.quantity} {it.unitCode}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {selectedOrder.currencyCode} {it.unitPriceFob.toFixed(2)}
                            </td>
                            <td className="p-2 text-right font-mono font-bold">
                              {selectedOrder.currencyCode} {it.totalFob.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {activeTab === 'TIMELINE' && (
                <Card className="p-4">
                  <div className="border-l-2 border-primary/40 ml-3 space-y-4 py-1 text-xs">
                    {STAGES.map((stageName, idx) => {
                      const isCompleted = idx <= selectedOrder.currentStageIndex;
                      const isCurrent = idx === selectedOrder.currentStageIndex;
                      const historyRecord = (selectedOrder.stages || []).find(
                        (st) => st.stageIndex === idx
                      );

                      return (
                        <div key={stageName} className="relative pl-6">
                          <div
                            className={`absolute -left-2.5 top-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCompleted
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted border border-border text-muted-foreground'
                            }`}
                          >
                            {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : idx + 1}
                          </div>
                          <div>
                            <p
                              className={`font-semibold ${
                                isCurrent
                                  ? 'text-primary'
                                  : isCompleted
                                  ? 'text-foreground'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {idx + 1}. {stageName}
                            </p>
                            {historyRecord ? (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                <span>{new Date(historyRecord.transitionDate).toLocaleString('es-PE')}</span>
                                {historyRecord.evidenceNotes && (
                                  <p className="italic text-foreground mt-0.5">
                                    "{historyRecord.evidenceNotes}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60">Pendiente</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-12 text-center text-xs text-muted-foreground">
              Seleccione una orden de importación para ver sus detalles y checklist.
            </Card>
          )}
        </div>
      </div>

      {/* Modal Nueva Orden */}
      <NewImportOrderModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={loadOrders}
      />

      {/* Modal Avanzar de Etapa */}
      {selectedOrderForAdvance && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedOrderForAdvance(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileCheck className="h-5 w-5 text-primary" />
                Avanzar Etapa: {selectedOrderForAdvance.orderNumber}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Etapa actual: <span className="font-semibold text-foreground">{selectedOrderForAdvance.currentStage}</span> (Paso {selectedOrderForAdvance.currentStageIndex + 1} de {STAGES.length})
              </p>
            </DialogHeader>

            <form onSubmit={handleAdvanceStage} className="space-y-3 py-2 text-xs">
              <div className="bg-muted p-3 rounded-md">
                <span className="text-muted-foreground">Siguiente etapa normativa:</span>
                <p className="text-sm font-bold text-primary mt-0.5">
                  {selectedOrderForAdvance.currentStageIndex + 2}. {STAGES[selectedOrderForAdvance.currentStageIndex + 1]}
                </p>
              </div>

              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">
                  Evidencia Documental / Notas de Transición
                </label>
                <Input
                  placeholder="ej: Factura Proforma recibida o BL emitido por naviera"
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">
                  N° de Documento / Constancia (Opcional)
                </label>
                <Input
                  placeholder="ej: BL-MSK-2026-99"
                  value={advanceDocNumber}
                  onChange={(e) => setAdvanceDocNumber(e.target.value)}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground uppercase text-[10px]">
                  URL de Documento en Supabase Storage (Opcional)
                </label>
                <Input
                  placeholder="https://supabase-storage.internal/..."
                  value={advanceDocUrl}
                  onChange={(e) => setAdvanceDocUrl(e.target.value)}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedOrderForAdvance(null)}
                  disabled={isAdvancing}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isAdvancing} className="gap-1.5 bg-primary">
                  {isAdvancing ? 'Avanzando...' : 'Confirmar Avance'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Adjuntar Documento al Checklist */}
      {selectedOrder && (
        <AddOrderDocumentModal
          isOpen={isAddDocOpen}
          onClose={() => setIsAddDocOpen(false)}
          order={selectedOrder}
          onSuccess={async () => {
            await loadChecklist(selectedOrder.id);
            await loadOrders();
          }}
          onSubmit={handleAddDocument}
          defaultStageIndex={docModalStageIndex}
        />
      )}

      {/* Modal de Recepción en Almacén */}
      {selectedOrder && (
        <GoodsReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          declarationId={selectedOrder.shipment?.id || selectedOrder.id}
          shipmentId={selectedOrder.shipment?.id}
          initialItems={itemsForReceipt}
          onSuccess={async () => {
            setIsReceiptModalOpen(false);
            await loadOrders();
          }}
        />
      )}
    </Page>
  );
}
