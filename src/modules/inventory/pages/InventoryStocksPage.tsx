import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../services/inventoryApi';
import { type InventoryBalance } from '../types/inventory.types';
import { ProductModal } from '../components/ProductModal';
import { ProductDetailDrawer } from '../components/ProductDetailDrawer';
import { ManualMovementModal } from '../components/ManualMovementModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Boxes,
  PlusCircle,
  ArrowLeftRight,
  BookOpen,
  Search,
  RefreshCw,
  Info,
  DollarSign,
  CheckCircle2,
  Eye,
  Edit2,
  Trash2,
  Download,
} from 'lucide-react';

export default function InventoryStocksPage() {
  const navigate = useNavigate();
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [totalValuation, setTotalValuation] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryBalance | null>(null);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<InventoryBalance | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedSkuForMovement, setSelectedSkuForMovement] = useState<string | undefined>();
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await inventoryApi.getStockBalances();
      setBalances(data.balances || []);
      setTotalValuation(data.totalValuationPen || 0);
    } catch (err) {
      console.error('Error cargando existencias:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshState('loading');
    await loadData();
    setRefreshState('success');
    setTimeout(() => setRefreshState('idle'), 1800);
  };

  useEffect(() => {
    loadData();
  }, []);

  const warehouseOptions = Array.from(
    new Set(balances.map((b) => b.warehouseCode).filter((w): w is string => Boolean(w)))
  );

  const filteredBalances = balances.filter((b) => {
    if (selectedWarehouse !== 'ALL' && b.warehouseCode !== selectedWarehouse) {
      return false;
    }
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return true;
    const sku = String(b.sku || '').toLowerCase();
    const desc = String(b.description || '').toLowerCase();
    const brand = String(b.brand || '').toLowerCase();
    const cat = String(b.category || '').toLowerCase();
    return sku.includes(term) || desc.includes(term) || brand.includes(term) || cat.includes(term);
  });

  const handleOpenDetail = (b: InventoryBalance) => {
    setSelectedProductForDetail(b);
    setIsDetailOpen(true);
  };

  const handleStartEdit = (b: InventoryBalance) => {
    setEditingProduct(b);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (b: InventoryBalance) => {
    const confirmed = window.confirm(
      `¿Está seguro de eliminar o retirar del catálogo el producto "${b.description}" (${b.sku})?\n\n` +
      `Nota de Auditoría Tributaria:\n` +
      `Si el producto ya registra movimientos en el Kardex (compras, importaciones o ventas), el sistema lo marcará como INACTIVO para preservar la trazabilidad exigida por SUNAT y la NIC 2.`
    );
    if (!confirmed) return;

    try {
      const res = await inventoryApi.deleteProduct(b.sku);
      setFeedbackMessage({ type: 'success', text: res.message });
      await loadData();
      setTimeout(() => setFeedbackMessage(null), 6000);
    } catch (err: any) {
      console.error('Error eliminando producto:', err);
      const errMsg = err?.response?.data?.message || 'Error al intentar eliminar el producto.';
      setFeedbackMessage({ type: 'error', text: errMsg });
      setTimeout(() => setFeedbackMessage(null), 6000);
    }
  };

  const handleExportCsv = () => {
    if (filteredBalances.length === 0) {
      alert('No hay registros de inventario disponibles para exportar.');
      return;
    }
    const headers = [
      'Almacen',
      'Codigo SKU',
      'Descripcion',
      'Marca',
      'Modelo',
      'Categoria',
      'Partida Arancelaria SPN',
      'Stock Fisico',
      'Unidad Medida SUNAT',
      'Costo Promedio Unitario PEN',
      'Total Valuado PEN',
    ];
    const rows = filteredBalances.map((b) => [
      `"${b.warehouseCode || 'ALM-01'}"`,
      `"${b.sku}"`,
      `"${(b.description || '').replace(/"/g, '""')}"`,
      `"${(b.brand || '').replace(/"/g, '""')}"`,
      `"${(b.model || '').replace(/"/g, '""')}"`,
      `"${(b.category || '').replace(/"/g, '""')}"`,
      `"${b.hsCode || ''}"`,
      b.currentStock,
      `"${b.sunatUnitCode || 'NIU'}"`,
      b.averageUnitCost.toFixed(4),
      b.totalInventoryValue.toFixed(2),
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalogo_existencias_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Banner Informativo Desacoplamiento */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Módulo de Inventario y Kardex Oficial:</span> Valuación perpetua por Promedio Ponderado Móvil (NIC 2 / Art. 35 LIR). Integra automáticamente compras nacionales, importaciones nacionalizadas (Op. 18) y salidas por facturación electrónica.
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium border flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setFeedbackMessage(null)}
          >
            ✕
          </Button>
        </div>
      )}

      {/* Header & Acciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Boxes className="h-7 w-7 text-primary" />
            Existencias y Catálogo de Almacén
          </h1>
          <p className="text-sm text-muted-foreground">
            Control de inventario físico permanente, fichas técnicas y valorización en soles (PEN).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5" title="Descargar inventario valorizado en formato CSV">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>

          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshState === 'loading'} className="gap-1.5">
            {refreshState === 'loading' ? (
              <><RefreshCw className="h-4 w-4 animate-spin text-primary" /><span>Actualizando...</span></>
            ) : refreshState === 'success' ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-emerald-500 font-medium">Actualizado</span></>
            ) : (
              <><RefreshCw className="h-4 w-4" /><span>Actualizar</span></>
            )}
          </Button>

          <Button size="sm" variant="secondary" onClick={() => setIsMovementModalOpen(true)} className="gap-1">
            <ArrowLeftRight className="h-4 w-4" /> Movimiento Manual
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="gap-1 font-bold shadow-xs"
          >
            <PlusCircle className="h-4 w-4" /> + Nuevo Producto (Ficha Técnica)
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Valorización Total (PEN)</p>
              <p className="text-2xl font-bold text-primary mt-1">S/ {totalValuation.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full text-primary"><DollarSign className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Total Ítems en Catálogo</p>
              <p className="text-2xl font-bold mt-1">{balances.length}</p>
            </div>
            <div className="p-3 bg-secondary rounded-full"><Boxes className="h-6 w-6 text-foreground" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Libro PLE Obligatorio</p>
              <Button variant="link" className="p-0 h-auto text-sm font-semibold text-primary mt-1" onClick={() => navigate('/kardex/ple')}>
                Gestionar PLE 12.1 / 13.1 &rarr;
              </Button>
            </div>
            <div className="p-3 bg-primary/10 rounded-full text-primary"><BookOpen className="h-6 w-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Existencias */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por SKU, descripción, marca o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-semibold uppercase whitespace-nowrap">Almacén:</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">Todos los Almacenes</option>
              {warehouseOptions.map((w) => (
                <option key={w} value={w}>
                  {w} {w === 'ALM-01' ? '(Principal)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border rounded-md bg-card overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground uppercase text-[11px]">
                <th className="p-3">Almacén</th>
                <th className="p-3">Código SKU</th>
                <th className="p-3">Descripción y Marca</th>
                <th className="p-3 text-right">Stock Físico</th>
                <th className="p-3 text-right">Costo Promedio (PEN)</th>
                <th className="p-3 text-right">Total Valuado (PEN)</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Cargando existencias de inventario...</td></tr>
              ) : filteredBalances.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No se encontraron productos registrados en el inventario.</td></tr>
              ) : (
                filteredBalances.map((b) => (
                  <tr key={b.id || b.sku} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-semibold">{b.warehouseCode || 'ALM-01'}</td>
                    <td className="p-3 font-mono font-bold text-primary">{b.sku}</td>
                    <td className="p-3">
                      <p className="font-medium text-foreground">{b.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {b.brand && (
                          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded font-semibold">
                            {b.brand}
                          </span>
                        )}
                        {b.category && (
                          <span className="text-[10px] text-muted-foreground border px-1.5 py-0.2 rounded">
                            {b.category}
                          </span>
                        )}
                        {b.hsCode && (
                          <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                            SPN: {b.hsCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{b.currentStock.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                        <Badge variant="outline" className="text-[10px] font-mono py-0 px-1 text-muted-foreground bg-muted/40 font-normal">
                          {b.sunatUnitCode || 'NIU'}
                        </Badge>
                      </div>
                      {b.currentStock <= 0 ? (
                        <div className="mt-1 flex justify-end">
                          <Badge variant="destructive" className="text-[9px] py-0 px-1.5 uppercase font-bold tracking-wider">
                            Agotado
                          </Badge>
                        </div>
                      ) : b.minStockAlert && b.currentStock <= b.minStockAlert ? (
                        <div className="mt-1 flex justify-end">
                          <Badge className="text-[9px] py-0 px-1.5 uppercase font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30 dark:text-amber-400">
                            Stock Bajo ({b.minStockAlert} min)
                          </Badge>
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right font-mono">
                      S/ {b.averageUnitCost.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      S/ {b.totalInventoryValue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-foreground hover:text-primary"
                          title="Ver Ficha Técnica y Detalle Completo"
                          onClick={() => handleOpenDetail(b)}
                        >
                          <Eye className="h-3.5 w-3.5" /> Ficha
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700"
                          title="Editar Ficha Técnica del Producto"
                          onClick={() => handleStartEdit(b)}
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          title="Consultar Kardex Valorizado (PLE 13.1)"
                          onClick={() => navigate(`/kardex/producto?sku=${encodeURIComponent(b.sku)}`)}
                        >
                          <BookOpen className="h-3.5 w-3.5" /> Kardex
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary"
                          title="Registrar Movimiento para este SKU"
                          onClick={() => { setSelectedSkuForMovement(b.sku); setIsMovementModalOpen(true); }}
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" /> Mover
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Eliminar o Inactivar Producto"
                          onClick={() => handleDeleteProduct(b)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={loadData}
        initialData={editingProduct}
        mode={editingProduct ? 'edit' : 'create'}
      />

      <ProductDetailDrawer
        product={selectedProductForDetail}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedProductForDetail(null);
        }}
        onEdit={handleStartEdit}
        onOpenKardex={(sku) => navigate(`/kardex/producto?sku=${encodeURIComponent(sku)}`)}
      />

      <ManualMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => { setIsMovementModalOpen(false); setSelectedSkuForMovement(undefined); }}
        onSuccess={loadData}
        defaultSku={selectedSkuForMovement}
      />
    </div>
  );
}


