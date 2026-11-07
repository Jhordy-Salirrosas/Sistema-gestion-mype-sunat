import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
} from '@/components/ui';
import {
  ClipboardCheck,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Eye,
  Download,
  Search,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  inventoryLedgerApi,
  type InventoryAdjustmentRecord,
  type AdjustmentItemRecord,
} from '../services/inventoryLedgerApi';
import { inventoryApi } from '../services/inventoryApi';

const today = () => new Date().toISOString().slice(0, 10);

const apiError = (error: unknown): string => {
  const err = error as { response?: { data?: { message?: unknown } }; message?: string };
  const message = err.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  if (typeof message === 'string') return message;
  return err.message || 'No se pudo registrar el ajuste.';
};

const COMMON_REASONS = [
  'Diferencia por conteo físico periódico (Toma física)',
  'Merma normal de almacenamiento / manipuleo (Art. 37 LIR)',
  'Desmedro por vencimiento o deterioro (Destrucción notarial)',
  'Sobrante justificado de inventario físico',
  'Error de digitación en guía o comprobante anterior',
];

export default function InventoryAdjustmentsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<InventoryAdjustmentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ENTRADA' | 'SALIDA'>('ALL');

  const [form, setForm] = useState({
    warehouseCode: 'ALM-01',
    type: 'ENTRADA' as 'ENTRADA' | 'SALIDA',
    reason: '',
    adjustmentDate: today(),
    responsible: '',
    notes: '',
  });
  const [items, setItems] = useState([{ sku: '', quantity: 1, unitCost: 0 }]);

  const adjustments = useQuery({
    queryKey: ['inventory', 'adjustments'],
    queryFn: inventoryLedgerApi.getAdjustments,
  });

  const warehouses = useQuery({
    queryKey: ['inventory', 'warehouses'],
    queryFn: inventoryLedgerApi.getWarehouses,
  });

  const stocks = useQuery({
    queryKey: ['inventory', 'stocks'],
    queryFn: inventoryApi.getStockBalances,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      inventoryLedgerApi.createAdjustment({
        ...form,
        items: items
          .filter((i) => i.sku.trim() && i.quantity > 0)
          .map((i) => ({
            sku: i.sku.trim().toUpperCase(),
            quantity: Number(i.quantity),
            unitCost: form.type === 'ENTRADA' ? Number(i.unitCost || 0) : undefined,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stocks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
      setIsOpen(false);
      setError(null);
      setItems([{ sku: '', quantity: 1, unitCost: 0 }]);
    },
    onError: (e) => setError(apiError(e)),
  });

  const updateItem = (index: number, patch: Partial<{ sku: string; quantity: number; unitCost: number }>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const getAdjustmentTotal = (itemsList: AdjustmentItemRecord[] = []): number => {
    return itemsList.reduce((acc, it) => {
      const diff = Math.abs(Number(it.difference_quantity) || Number(it.counted_quantity) || 0);
      const cost = Number(it.unit_cost) || 0;
      return acc + diff * cost;
    }, 0);
  };

  const getAdjustmentUnits = (itemsList: AdjustmentItemRecord[] = []): number => {
    return itemsList.reduce((acc, it) => {
      return acc + Math.abs(Number(it.difference_quantity) || Number(it.counted_quantity) || 0);
    }, 0);
  };

  const allAdjustments = adjustments.data ?? [];

  const filteredAdjustments = allAdjustments.filter((a) => {
    if (warehouseFilter !== 'ALL' && a.warehouse_code !== warehouseFilter) return false;
    if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const num = (a.adjustment_number || '').toLowerCase();
    const reason = (a.reason || '').toLowerCase();
    const resp = (a.responsible || '').toLowerCase();
    const hasSku = a.items.some(
      (i) => (i.sku || '').toLowerCase().includes(term) || (i.description || '').toLowerCase().includes(term)
    );
    return num.includes(term) || reason.includes(term) || resp.includes(term) || hasSku;
  });

  // Métricas rápidas
  const totalEntriesValuation = filteredAdjustments
    .filter((a) => a.type === 'ENTRADA')
    .reduce((acc, a) => acc + getAdjustmentTotal(a.items), 0);

  const totalExitsValuation = filteredAdjustments
    .filter((a) => a.type === 'SALIDA')
    .reduce((acc, a) => acc + getAdjustmentTotal(a.items), 0);

  const warehouseList = warehouses.data ?? [
    { warehouse_code: 'ALM-01', description: 'Almacén Principal' },
    { warehouse_code: 'ALM-02', description: 'Almacén Secundario' },
  ];

  const availableWarehouseStock = (stocks.data?.balances ?? []).filter(
    (b) => b.warehouseCode === form.warehouseCode
  );

  const handleExportCsv = () => {
    if (filteredAdjustments.length === 0) {
      alert('No hay ajustes de inventario para exportar.');
      return;
    }
    const headers = [
      'Numero Ajuste',
      'Fecha',
      'Almacen',
      'Tipo Sentido',
      'Motivo',
      'Responsable',
      'Observaciones',
      'SKU',
      'Descripcion',
      'Cantidad Sistema',
      'Cantidad Contada',
      'Diferencia Fisica',
      'Costo Unitario PEN',
      'Total Impacto PEN',
      'Estado',
    ];
    const rows: string[] = [];
    filteredAdjustments.forEach((a) => {
      a.items.forEach((it) => {
        const diff = Math.abs(Number(it.difference_quantity) || Number(it.counted_quantity) || 0);
        const cost = Number(it.unit_cost) || 0;
        const total = diff * cost;
        rows.push([
          `"${a.adjustment_number}"`,
          `"${a.adjustment_date.slice(0, 10)}"`,
          `"${a.warehouse_code}"`,
          `"${a.type === 'ENTRADA' ? 'Sobrante (+)' : 'Faltante / Merma (-)'}"`,
          `"${(a.reason || '').replace(/"/g, '""')}"`,
          `"${(a.responsible || '').replace(/"/g, '""')}"`,
          `"${(a.notes || '').replace(/"/g, '""')}"`,
          `"${it.sku}"`,
          `"${(it.description || '').replace(/"/g, '""')}"`,
          it.system_quantity,
          it.counted_quantity,
          it.difference_quantity,
          cost.toFixed(4),
          total.toFixed(2),
          `"${a.status}"`,
        ].join(','));
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ajustes_toma_fisica_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <PageHeader
        title="Ajustes y toma física"
        description="Correcciones de inventario físico por merma, desmedro, error de conteo o sobrante justificado (Art. 37 LIR / Op. 28 SUNAT)."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="gap-1.5"
          title="Descargar historial de ajustes en CSV"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => adjustments.refetch()}
          disabled={adjustments.isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${adjustments.isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setError(null);
            setIsOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo ajuste
        </Button>
      </PageHeader>

      {/* Tarjetas de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Ajustes Registrados</p>
            <p className="text-2xl font-bold mt-1">{filteredAdjustments.length}</p>
          </div>
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Sobrantes Físicos (+)</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
              +S/ {totalEntriesValuation.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Faltantes / Mermas (-)</p>
            <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400 font-mono">
              -S/ {totalExitsValuation.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-full bg-amber-500/10 text-amber-600">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card/60 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por N° ajuste, SKU, motivo o responsable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground font-semibold uppercase">Tipo:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'ENTRADA' | 'SALIDA')}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">Todos los tipos</option>
              <option value="ENTRADA">Sobrante (Entrada)</option>
              <option value="SALIDA">Faltante / Merma (Salida)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground font-semibold uppercase">Almacén:</label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">Todos</option>
              {warehouseList.map((w) => (
                <option key={w.warehouse_code} value={w.warehouse_code}>
                  {w.warehouse_code}
                </option>
              ))}
            </select>
          </div>

          {(searchTerm || warehouseFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchTerm('');
                setWarehouseFilter('ALL');
                setTypeFilter('ALL');
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px]">
            <tr>
              <th className="p-3">Número</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Almacén</th>
              <th className="p-3">Tipo Sentido</th>
              <th className="p-3">Motivo del Ajuste</th>
              <th className="p-3">Ítems Ajustados</th>
              <th className="p-3 text-right">Impacto Valuado (PEN)</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.isLoading ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  Cargando ajustes de inventario...
                </td>
              </tr>
            ) : filteredAdjustments.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  No hay ajustes registrados con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredAdjustments.map((a) => {
                const totalVal = getAdjustmentTotal(a.items);
                const totalUnits = getAdjustmentUnits(a.items);
                const firstSku = a.items[0]?.sku;
                const isEntry = a.type === 'ENTRADA';

                return (
                  <tr key={a.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-primary">{a.adjustment_number}</td>
                    <td className="p-3 font-mono">
                      {new Date(a.adjustment_date).toLocaleDateString('es-PE')}
                    </td>
                    <td className="p-3 font-semibold text-foreground">{a.warehouse_code}</td>
                    <td className="p-3">
                      {isEntry ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 text-[10px] font-semibold">
                          <ArrowDownLeft className="h-3 w-3" /> Sobrante (+)
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1 text-[10px] font-semibold">
                          <ArrowUpRight className="h-3 w-3" /> Faltante / Merma (-)
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 max-w-[220px]">
                      <p className="font-medium text-foreground truncate" title={a.reason}>
                        {a.reason}
                      </p>
                      {a.notes && (
                        <p className="text-[10px] text-muted-foreground truncate" title={a.notes}>
                          {a.notes}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                          {a.items.length} producto(s)
                        </Badge>
                        <span className="text-muted-foreground text-[11px]">
                          ({totalUnits.toLocaleString('es-PE', { minimumFractionDigits: 2 })} und.)
                        </span>
                        {firstSku && (
                          <span className="text-[10px] text-muted-foreground">
                            • {firstSku}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${isEntry ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {isEntry ? '+' : '-'}S/ {totalVal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={a.status === 'APLICADO' ? 'default' : 'secondary'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAdjustment(a)}
                        className="h-7 text-xs gap-1 text-primary hover:text-primary"
                        title="Ver detalle del conteo y diferencia valorizada"
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver Detalle
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Modal Ver Detalle de Ajuste / Acta de Conteo */}
      {selectedAdjustment && (
        <Dialog open={!!selectedAdjustment} onOpenChange={(open) => !open && setSelectedAdjustment(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Acta de Ajuste Físico {selectedAdjustment.adjustment_number}
                </DialogTitle>
                <Badge variant={selectedAdjustment.status === 'APLICADO' ? 'default' : 'secondary'}>
                  {selectedAdjustment.status}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Resumen Cabecera */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-muted/40 border">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Fecha:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(selectedAdjustment.adjustment_date).toLocaleDateString('es-PE')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Almacén:</span>
                  <span className="font-bold text-primary">{selectedAdjustment.warehouse_code}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Sentido:</span>
                  <span className={`font-bold ${selectedAdjustment.type === 'ENTRADA' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedAdjustment.type === 'ENTRADA' ? 'Sobrante (+)' : 'Faltante / Merma (-)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Responsable:</span>
                  <span className="font-medium text-foreground">{selectedAdjustment.responsible || '—'}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-card space-y-1">
                <span className="font-semibold text-muted-foreground uppercase text-[10px] block">
                  Motivo y Justificación Tributaria:
                </span>
                <p className="font-medium text-foreground">{selectedAdjustment.reason}</p>
                {selectedAdjustment.notes && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    <span className="font-semibold">Notas / Informe técnico:</span> {selectedAdjustment.notes}
                  </p>
                )}
              </div>

              {/* Tabla de Productos del Ajuste */}
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Código SKU</th>
                      <th className="p-2.5">Descripción</th>
                      <th className="p-2.5 text-right">Cant. Sistema</th>
                      <th className="p-2.5 text-right">Cant. Contada</th>
                      <th className="p-2.5 text-right">Diferencia</th>
                      <th className="p-2.5 text-right">Costo Unit. (PEN)</th>
                      <th className="p-2.5 text-right">Impacto Total (PEN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAdjustment.items.map((it) => {
                      const diff = Math.abs(Number(it.difference_quantity) || Number(it.counted_quantity) || 0);
                      const cost = Number(it.unit_cost) || 0;
                      const total = diff * cost;
                      const isEntry = selectedAdjustment.type === 'ENTRADA';

                      return (
                        <tr key={it.id || it.sku} className="border-t">
                          <td className="p-2.5 font-mono font-bold text-primary">{it.sku}</td>
                          <td className="p-2.5 font-medium text-foreground">{it.description || '—'}</td>
                          <td className="p-2.5 text-right font-mono text-muted-foreground">
                            {Number(it.system_quantity || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            {Number(it.counted_quantity || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`p-2.5 text-right font-mono font-bold ${isEntry ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {isEntry ? '+' : '-'}{diff.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            S/ {cost.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </td>
                          <td className={`p-2.5 text-right font-mono font-bold ${isEntry ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {isEntry ? '+' : '-'}S/ {total.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t bg-muted/40 font-bold">
                    <tr>
                      <td colSpan={6} className="p-2.5 text-right uppercase text-[10px] text-muted-foreground">
                        Impacto Total Valuado en Libros:
                      </td>
                      <td className="p-2.5 text-right font-mono text-sm text-foreground">
                        {selectedAdjustment.type === 'ENTRADA' ? '+' : '-'}S/ {getAdjustmentTotal(selectedAdjustment.items).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 text-xs w-full sm:w-auto"
              >
                <Printer className="h-4 w-4" />
                Imprimir Acta de Conteo
              </Button>
              <Button size="sm" onClick={() => setSelectedAdjustment(null)} className="w-full sm:w-auto">
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Nuevo Ajuste */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Nuevo ajuste de inventario / Toma física
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Almacén *</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.warehouseCode}
                onChange={(e) => setForm({ ...form, warehouseCode: e.target.value })}
              >
                {warehouseList.map((w) => (
                  <option key={w.warehouse_code} value={w.warehouse_code}>
                    {w.warehouse_code} — {w.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Sentido del Ajuste *</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'ENTRADA' | 'SALIDA' })}
              >
                <option value="ENTRADA">Entrada (Sobrante físico detectado)</option>
                <option value="SALIDA">Salida (Faltante / Merma / Desmedro)</option>
              </select>
            </div>
            <div>
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Fecha del conteo *</p>
              <Input
                type="date"
                value={form.adjustmentDate}
                onChange={(e) => setForm({ ...form, adjustmentDate: e.target.value })}
              />
            </div>
            <div>
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Responsable del Conteo</p>
              <Input
                placeholder="Nombre del auditor o jefe de almacén"
                value={form.responsible}
                onChange={(e) => setForm({ ...form, responsible: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Motivo del Ajuste *</p>
              <Input
                placeholder="Seleccione o ingrese el motivo del ajuste..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                list="common-reasons"
              />
              <datalist id="common-reasons">
                {COMMON_REASONS.map((r, i) => (
                  <option key={i} value={r} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground text-[10px]">
                Productos a regularizar *
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setItems([...items, { sku: '', quantity: 1, unitCost: 0 }])}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" /> Agregar producto
              </Button>
            </div>

            {items.map((item, index) => {
              const matchedBalance = availableWarehouseStock.find(
                (b) => b.sku.toLowerCase() === item.sku.toLowerCase()
              );

              return (
                <div key={index} className="space-y-1 p-2 rounded border bg-muted/20">
                  <div className="grid grid-cols-[1fr_90px_100px_32px] gap-2 items-center">
                    <div>
                      {availableWarehouseStock.length > 0 ? (
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={item.sku}
                          onChange={(e) => {
                            const newSku = e.target.value;
                            const bal = availableWarehouseStock.find((b) => b.sku === newSku);
                            updateItem(index, {
                              sku: newSku,
                              unitCost: bal ? bal.averageUnitCost : item.unitCost,
                            });
                          }}
                        >
                          <option value="">Seleccione producto...</option>
                          {availableWarehouseStock.map((b) => (
                            <option key={b.sku} value={b.sku}>
                              {b.sku} — {b.description} (Sistema: {b.currentStock} {b.sunatUnitCode || 'NIU'})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          placeholder="SKU (ej. CEM-001)"
                          value={item.sku}
                          onChange={(e) => updateItem(index, { sku: e.target.value })}
                        />
                      )}
                    </div>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      placeholder="Cantidad"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="Costo Unit."
                      disabled={form.type === 'SALIDA'}
                      value={item.unitCost}
                      onChange={(e) => updateItem(index, { unitCost: Number(e.target.value) })}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={items.length === 1}
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>

                  {matchedBalance && (
                    <p className="text-[10px] text-muted-foreground px-1">
                      Stock actual en {form.warehouseCode}: <span className="font-semibold text-primary">{matchedBalance.currentStock} {matchedBalance.sunatUnitCode || 'NIU'}</span> · Costo prom. móvil: S/ {matchedBalance.averageUnitCost.toFixed(4)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">
              Observaciones / Número de Informe Técnico Notarial
            </p>
            <Input
              placeholder="ej: Informe Técnico N° 012-2026 / Acta de destrucción notarial"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.reason.trim() || items.every((i) => !i.sku.trim())}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {createMutation.isPending ? 'Aplicando...' : 'Aplicar ajuste contable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
