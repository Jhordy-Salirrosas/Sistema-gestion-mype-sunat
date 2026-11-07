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
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Eye,
  Download,
  Search,
  Printer,
  Boxes,
  DollarSign,
} from 'lucide-react';
import {
  inventoryLedgerApi,
  type InventoryTransferRecord,
  type TransferItemRecord,
} from '../services/inventoryLedgerApi';
import { inventoryApi } from '../services/inventoryApi';

const today = () => new Date().toISOString().slice(0, 10);

const apiError = (error: unknown): string => {
  const err = error as { response?: { data?: { message?: unknown } }; message?: string };
  const message = err.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  if (typeof message === 'string') return message;
  return err.message || 'No se pudo registrar la transferencia.';
};

export default function InventoryTransfersPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransferRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('ALL');
  const [destFilter, setDestFilter] = useState('ALL');

  const [form, setForm] = useState({
    fromWarehouseCode: 'ALM-01',
    toWarehouseCode: 'ALM-02',
    transferDate: today(),
    responsible: '',
    notes: '',
  });
  const [items, setItems] = useState([{ sku: '', quantity: 1 }]);

  const transfers = useQuery({
    queryKey: ['inventory', 'transfers'],
    queryFn: inventoryLedgerApi.getTransfers,
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
      inventoryLedgerApi.createTransfer({
        ...form,
        items: items
          .filter((i) => i.sku.trim() && i.quantity > 0)
          .map((i) => ({ sku: i.sku.trim().toUpperCase(), quantity: Number(i.quantity) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stocks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
      setIsOpen(false);
      setError(null);
      setItems([{ sku: '', quantity: 1 }]);
    },
    onError: (e) => setError(apiError(e)),
  });

  const updateItem = (index: number, patch: Partial<{ sku: string; quantity: number }>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const getTransferTotal = (itemsList: TransferItemRecord[] = []): number => {
    return itemsList.reduce((acc, it) => {
      const val = Number(it.total_cost) || Number(it.quantity) * Number(it.unit_cost) || 0;
      return acc + val;
    }, 0);
  };

  const getTransferUnits = (itemsList: TransferItemRecord[] = []): number => {
    return itemsList.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  };

  const allTransfers = transfers.data ?? [];

  const filteredTransfers = allTransfers.filter((t) => {
    if (originFilter !== 'ALL' && t.from_warehouse_code !== originFilter) return false;
    if (destFilter !== 'ALL' && t.to_warehouse_code !== destFilter) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const num = (t.transfer_number || '').toLowerCase();
    const resp = (t.responsible || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    const hasSku = t.items.some((i) => (i.sku || '').toLowerCase().includes(term) || (i.description || '').toLowerCase().includes(term));
    return num.includes(term) || resp.includes(term) || notes.includes(term) || hasSku;
  });

  const totalTransferredValuation = filteredTransfers.reduce(
    (acc, t) => acc + getTransferTotal(t.items),
    0
  );

  const totalTransferredUnits = filteredTransfers.reduce(
    (acc, t) => acc + getTransferUnits(t.items),
    0
  );

  // Almacenes disponibles
  const warehouseList = warehouses.data ?? [
    { warehouse_code: 'ALM-01', description: 'Almacén Principal' },
    { warehouse_code: 'ALM-02', description: 'Almacén Secundario' },
  ];

  // Stock disponible en el almacén origen seleccionado
  const availableOriginStock = (stocks.data?.balances ?? []).filter(
    (b) => b.warehouseCode === form.fromWarehouseCode
  );

  const handleExportCsv = () => {
    if (filteredTransfers.length === 0) {
      alert('No hay transferencias para exportar.');
      return;
    }
    const headers = [
      'Numero Transferencia',
      'Fecha',
      'Almacen Origen',
      'Almacen Destino',
      'Responsable',
      'Observaciones',
      'SKU',
      'Descripcion',
      'Cantidad',
      'Costo Unitario PEN',
      'Total Valuado PEN',
      'Estado',
    ];
    const rows: string[] = [];
    filteredTransfers.forEach((t) => {
      t.items.forEach((it) => {
        rows.push([
          `"${t.transfer_number}"`,
          `"${t.transfer_date.slice(0, 10)}"`,
          `"${t.from_warehouse_code}"`,
          `"${t.to_warehouse_code}"`,
          `"${(t.responsible || '').replace(/"/g, '""')}"`,
          `"${(t.notes || '').replace(/"/g, '""')}"`,
          `"${it.sku}"`,
          `"${(it.description || '').replace(/"/g, '""')}"`,
          it.quantity,
          Number(it.unit_cost).toFixed(4),
          Number(it.total_cost).toFixed(2),
          `"${t.status}"`,
        ].join(','));
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transferencias_inventario_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <PageHeader
        title="Transferencias entre almacenes"
        description="Salida de un almacén y entrada al destino, valorizadas al costo promedio móvil (NIC 2 / SUNAT)."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="gap-1.5"
          title="Descargar reporte detallado en CSV"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => transfers.refetch()}
          disabled={transfers.isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${transfers.isFetching ? 'animate-spin' : ''}`} />
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
          Nueva transferencia
        </Button>
      </PageHeader>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Transferencias</p>
            <p className="text-2xl font-bold mt-1">{filteredTransfers.length}</p>
          </div>
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Unidades Trasladadas</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {totalTransferredUnits.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600">
            <Boxes className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Valor Total Trasladado (PEN)</p>
            <p className="text-2xl font-bold mt-1 text-primary font-mono">
              S/ {totalTransferredValuation.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <DollarSign className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card/60 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por N° transferencia, SKU, responsable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground font-semibold uppercase">Origen:</label>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
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

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground font-semibold uppercase">Destino:</label>
            <select
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
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

          {(searchTerm || originFilter !== 'ALL' || destFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchTerm('');
                setOriginFilter('ALL');
                setDestFilter('ALL');
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
              <th className="p-3">Origen</th>
              <th className="p-3">Destino</th>
              <th className="p-3">Ítems Trasladados</th>
              <th className="p-3 text-right">Valor Total (PEN)</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {transfers.isLoading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Cargando transferencias de almacén...
                </td>
              </tr>
            ) : filteredTransfers.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No hay transferencias registradas con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredTransfers.map((t) => {
                const totalVal = getTransferTotal(t.items);
                const totalUnits = getTransferUnits(t.items);
                const firstSku = t.items[0]?.sku;

                return (
                  <tr key={t.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-primary">{t.transfer_number}</td>
                    <td className="p-3 font-mono">
                      {new Date(t.transfer_date).toLocaleDateString('es-PE')}
                    </td>
                    <td className="p-3 font-semibold text-foreground">{t.from_warehouse_code}</td>
                    <td className="p-3 font-semibold text-foreground">{t.to_warehouse_code}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                          {t.items.length} producto(s)
                        </Badge>
                        <span className="text-muted-foreground text-[11px]">
                          ({totalUnits.toLocaleString('es-PE', { minimumFractionDigits: 2 })} und.)
                        </span>
                        {firstSku && (
                          <span className="text-[10px] text-muted-foreground">
                            • {firstSku} {t.items.length > 1 ? `(+${t.items.length - 1})` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      S/ {totalVal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={t.status === 'CONFIRMADA' ? 'default' : 'secondary'}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTransfer(t)}
                        className="h-7 text-xs gap-1 text-primary hover:text-primary"
                        title="Ver detalle completo de los productos trasladados"
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

      {/* Modal Ver Detalle de Transferencia */}
      {selectedTransfer && (
        <Dialog open={!!selectedTransfer} onOpenChange={(open) => !open && setSelectedTransfer(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                  Transferencia {selectedTransfer.transfer_number}
                </DialogTitle>
                <Badge variant={selectedTransfer.status === 'CONFIRMADA' ? 'default' : 'secondary'}>
                  {selectedTransfer.status}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Bloque Cabecera de Auditoría */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-muted/40 border">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Fecha:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(selectedTransfer.transfer_date).toLocaleDateString('es-PE')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Origen:</span>
                  <span className="font-bold text-primary">{selectedTransfer.from_warehouse_code}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Destino:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedTransfer.to_warehouse_code}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Responsable:</span>
                  <span className="font-medium text-foreground">{selectedTransfer.responsible || '—'}</span>
                </div>
              </div>

              {selectedTransfer.notes && (
                <div className="p-3 rounded-lg border bg-card">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px] block mb-0.5">
                    Observaciones / Guía de Remisión (Sustento):
                  </span>
                  <p className="text-foreground">{selectedTransfer.notes}</p>
                </div>
              )}

              {/* Tabla de Productos Trasladados */}
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Código SKU</th>
                      <th className="p-2.5">Descripción del Producto</th>
                      <th className="p-2.5 text-right">Cantidad</th>
                      <th className="p-2.5 text-right">Costo Unit. (PEN)</th>
                      <th className="p-2.5 text-right">Total Valuado (PEN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransfer.items.map((it) => (
                      <tr key={it.id || it.sku} className="border-t">
                        <td className="p-2.5 font-mono font-bold text-primary">{it.sku}</td>
                        <td className="p-2.5 font-medium text-foreground">{it.description || '—'}</td>
                        <td className="p-2.5 text-right font-bold">
                          {Number(it.quantity).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          S/ {Number(it.unit_cost).toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          S/ {Number(it.total_cost).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/40 font-bold">
                    <tr>
                      <td colSpan={4} className="p-2.5 text-right uppercase text-[10px] text-muted-foreground">
                        Valorización Total del Traslado:
                      </td>
                      <td className="p-2.5 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                        S/ {getTransferTotal(selectedTransfer.items).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                Imprimir Vale de Traslado
              </Button>
              <Button size="sm" onClick={() => setSelectedTransfer(null)} className="w-full sm:w-auto">
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Nueva Transferencia */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              Nueva transferencia entre almacenes
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Almacén origen *</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.fromWarehouseCode}
                onChange={(e) => setForm({ ...form, fromWarehouseCode: e.target.value })}
              >
                {warehouseList.map((w) => (
                  <option key={w.warehouse_code} value={w.warehouse_code}>
                    {w.warehouse_code} — {w.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Almacén destino *</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.toWarehouseCode}
                onChange={(e) => setForm({ ...form, toWarehouseCode: e.target.value })}
              >
                {warehouseList.map((w) => (
                  <option key={w.warehouse_code} value={w.warehouse_code}>
                    {w.warehouse_code} — {w.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Fecha del traslado *</p>
              <Input
                type="date"
                value={form.transferDate}
                onChange={(e) => setForm({ ...form, transferDate: e.target.value })}
              />
            </div>
            <div>
              <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Responsable / Conductor</p>
              <Input
                placeholder="Nombre del encargado o transportista"
                value={form.responsible}
                onChange={(e) => setForm({ ...form, responsible: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground text-[10px]">
                Productos a trasladar *
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setItems([...items, { sku: '', quantity: 1 }])}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" /> Agregar producto
              </Button>
            </div>

            {items.map((item, index) => {
              const matchedBalance = availableOriginStock.find(
                (b) => b.sku.toLowerCase() === item.sku.toLowerCase()
              );
              return (
                <div key={index} className="space-y-1 p-2 rounded border bg-muted/20">
                  <div className="grid grid-cols-[1fr_110px_32px] gap-2 items-center">
                    <div>
                      {availableOriginStock.length > 0 ? (
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={item.sku}
                          onChange={(e) => updateItem(index, { sku: e.target.value })}
                        >
                          <option value="">Seleccione producto...</option>
                          {availableOriginStock.map((b) => (
                            <option key={b.sku} value={b.sku}>
                              {b.sku} — {b.description} (Stock: {b.currentStock} {b.sunatUnitCode || 'NIU'})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          placeholder="Código SKU (ej. LAP-001)"
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
                      Stock actual en {form.fromWarehouseCode}: <span className="font-semibold text-primary">{matchedBalance.currentStock} {matchedBalance.sunatUnitCode || 'NIU'}</span> · Costo prom: S/ {matchedBalance.averageUnitCost.toFixed(4)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">
              Guía de Remisión Remitente (GRE) / Observaciones
            </p>
            <Input
              placeholder="ej: T001-000123 (Guía Remisión Remitente) o Traslado para abastecimiento"
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
              disabled={
                createMutation.isPending ||
                form.fromWarehouseCode === form.toWarehouseCode ||
                items.every((i) => !i.sku.trim())
              }
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {createMutation.isPending ? 'Confirmando...' : 'Confirmar transferencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
