import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader, Button, Card, Badge } from '@/components/ui';
import {
  CustomsSubNav,
  CustomsKpiGrid,
  ComplianceTrafficLight,
  QuickTariffCalculatorModal,
} from '../components';
import { useShipments } from '../hooks/useShipments';
import { useCustomsSettlements } from '../hooks/useCustomsSettlements';
import { importOrdersApi, type ImportOrderRecord } from '../services/importOrdersApi';
import {
  ArrowRight,
  Calculator,
  ChevronRight,
  Ship,
  FilePlus,
  FileCheck2,
  Warehouse,
  CheckCircle2,
} from 'lucide-react';
import { type CustomsShipmentSummary } from '../types';

export default function CustomsDashboardPage() {
  const navigate = useNavigate();
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const { shipments } = useShipments();
  const { settlements } = useCustomsSettlements();
  const [orders, setOrders] = useState<ImportOrderRecord[]>([]);

  const loadOrders = async () => {
    try {
      const data = await importOrdersApi.listOrders();
      if (data && Array.isArray(data.items)) {
        setOrders(data.items);
      }
    } catch {
      // Usar lista vacía si backend aún no tiene órdenes
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const activeShipmentsList: CustomsShipmentSummary[] = shipments;

  const pendingSettlementsCount = settlements.filter((s) => s.status === 'GENERADA').length;
  const totalCifUsd = orders.length > 0
    ? orders.reduce((acc, o) => acc + (Number(o.totalCif) || Number(o.totalFob) || 0), 0)
    : 0;
  const ordersCount = orders.length;
  const activeShipmentsCount = activeShipmentsList.length;

  const formatDateFriendly = (dateStr?: string | null) => {
    if (!dateStr) return 'Fecha por confirmar';
    try {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getStageBadge = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (s.includes('LEVANTE') || s === 'CON_LEVANTE') {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] py-0 font-medium">
          Paso 3 de 4 · Con Levante SUNAT
        </Badge>
      );
    }
    if (s.includes('TRANSITO') || s === 'EN_TRANSITO') {
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] py-0 font-medium">
          Paso 2 de 4 · En Tránsito
        </Badge>
      );
    }
    if (s.includes('ARRIBADO')) {
      return (
        <Badge className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-[10px] py-0 font-medium">
          Paso 2 de 4 · Arribado al Callao
        </Badge>
      );
    }
    if (s.includes('RECEPCION') || s.includes('ALMACEN') || s.includes('COSTO')) {
      return (
        <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[10px] py-0 font-medium">
          Paso 4 de 4 · En Almacén / Kardex
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] py-0 font-mono">
        {status || 'Paso 1 · Pedido Emitido'}
      </Badge>
    );
  };

  return (
    <Page>
      <CustomsSubNav />

      <PageHeader
        title="Panel General de Importaciones"
        description="Flujo integral de importaciones: desde el pedido al exterior hasta el recojo y costeo en almacén (Kardex)."
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsCalculatorOpen(true)}
          className="gap-1.5 text-xs text-primary"
        >
          <Calculator className="h-3.5 w-3.5" />
          Simulador Arancelario
        </Button>
      </PageHeader>

      <div className="space-y-4">
        {/* PIPELINE VISUAL E INTERACTIVO DE 4 PASOS: DEL PEDIDO AL ALMACÉN */}
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 mb-3 border-b border-border/50 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ciclo de Vida de la Importación · 4 Pasos Cronológicos
                </h2>
              </div>
              <p className="text-xs text-foreground/80 mt-0.5">
                Seleccione cualquier etapa para acceder directamente a la gestión operativa correspondiente.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border/50">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Conectado a Kardex PLE 13.1 y Contabilidad PCGE 2019</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Paso 1: Pedidos al Exterior */}
            <div
              onClick={() => navigate('/customs/orders')}
              className="group relative flex flex-col justify-between p-3.5 rounded-lg border border-border bg-gradient-to-b from-card to-muted/20 hover:border-primary hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Paso 1
                  </span>
                  <FilePlus className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  1. Pedidos al Exterior
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                  Cotizaciones, proformas y órdenes de compra internacionales con proveedores.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground/80">
                  {ordersCount > 0 ? `${ordersCount} ${ordersCount === 1 ? 'Pedido activo' : 'Pedidos activos'}` : 'Sin pedidos'}
                </span>
                <span className="inline-flex items-center text-primary font-medium text-[11px] group-hover:translate-x-0.5 transition-transform">
                  Gestionar <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </div>
            </div>

            {/* Paso 2: Tránsito y Arribo */}
            <div
              onClick={() => navigate('/customs/shipments')}
              className="group relative flex flex-col justify-between p-3.5 rounded-lg border border-border bg-gradient-to-b from-card to-muted/20 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Paso 2
                  </span>
                  <Ship className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                  2. Tránsito y Arribo
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                  Embarque internacional, conocimiento de embarque BL / Guía aérea y tracking.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground/80">
                  {activeShipmentsCount > 0 ? `${activeShipmentsCount} ${activeShipmentsCount === 1 ? 'Embarque activo' : 'Embarques activos'}` : 'Sin tránsitos'}
                </span>
                <span className="inline-flex items-center text-blue-400 font-medium text-[11px] group-hover:translate-x-0.5 transition-transform">
                  Seguimiento <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </div>
            </div>

            {/* Paso 3: Despacho y Aduanas */}
            <div
              onClick={() => navigate('/customs/declarations')}
              className="group relative flex flex-col justify-between p-3.5 rounded-lg border border-border bg-gradient-to-b from-card to-muted/20 hover:border-amber-500 hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Paso 3
                  </span>
                  <FileCheck2 className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">
                  3. Despacho y Aduanas
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                  Numeración DAM (DUA), Canales SUNAT (Verde/Naranja/Rojo) y liquidación CDA.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground/80">
                  {pendingSettlementsCount > 0 ? `${pendingSettlementsCount} Liq. CDA pendientes` : 'Al día con SUNAT'}
                </span>
                <span className="inline-flex items-center text-amber-400 font-medium text-[11px] group-hover:translate-x-0.5 transition-transform">
                  Revisar DAM <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </div>
            </div>

            {/* Paso 4: Recojo y Almacén */}
            <div
              onClick={() => navigate('/customs/landed-cost')}
              className="group relative flex flex-col justify-between p-3.5 rounded-lg border border-border bg-gradient-to-b from-card to-muted/20 hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Paso 4
                  </span>
                  <Warehouse className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                  4. Recojo y Almacén
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                  Recepción física de mercadería, Landed Cost NIC 2 e ingreso a Kardex (Op 18).
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="font-medium text-emerald-400">
                  Listo para ingresar a Kardex
                </span>
                <span className="inline-flex items-center text-emerald-400 font-medium text-[11px] group-hover:translate-x-0.5 transition-transform">
                  Costear <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grilla de Métricas Financieras y Canales SUNAT */}
        <CustomsKpiGrid
          shipments={activeShipmentsList}
          pendingSettlementsCount={pendingSettlementsCount}
          totalCifUsd={totalCifUsd}
          exchangeRate={3.82}
        />

        {/* Semáforo de Plazos Críticos y Riesgos SUNAT */}
        <ComplianceTrafficLight />

        {/* Tabla de Expedientes Recientes a Ancho Completo */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Expedientes de Importación Recientes
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Seguimiento de embarques activos y su estado actual en las 4 etapas del flujo.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/customs/shipments')}
              className="text-xs text-primary gap-1 p-0 h-auto font-medium hover:bg-transparent"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="divide-y divide-border">
            {activeShipmentsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <p>No hay expedientes de importación activos en este momento.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/customs/orders')}
                  className="mt-3 text-xs gap-1.5"
                >
                  <FilePlus className="h-3.5 w-3.5 text-primary" />
                  Ir al Paso 1: Pedidos al Exterior
                </Button>
              </div>
            ) : (
              activeShipmentsList.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/customs/shipments/${s.id}`)}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/40 px-3 rounded-lg cursor-pointer transition-colors gap-2"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {s.shipment_number}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 font-mono">
                        {s.incoterm || 'FOB'}
                      </Badge>
                      {getStageBadge(s.status)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Proveedor: <span className="text-foreground/90 font-medium">{s.supplier_name || 'Proveedor Registrado'}</span>
                      {' · '}
                      ETA: <span className="text-foreground/90 font-medium">{formatDateFriendly(s.eta_date)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Simulador Arancelario Rápido */}
      <QuickTariffCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />
    </Page>
  );
}
