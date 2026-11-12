import { formatearReferenciaDocumento, numeroDocumentoSinSerie } from '../lib/documentReference';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Page, PageHeader, Button, Card, Input, Badge } from '@/components/ui';
import {
  BookOpen,
  RefreshCw,
  Search,
  Download,
  Wallet,
  LayoutGrid,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Package,
} from 'lucide-react';
import { inventoryLedgerApi } from '../services/inventoryLedgerApi';
import { inventoryApi } from '../services/inventoryApi';
import { KardexTabs } from '../components/KardexTabs';

const firstDay = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const money = (n: number) =>
  `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type KardexTab = 'stock' | 'cash' | 'consolidated';

export default function InventoryKardexPage() {
  const [activeTab, setActiveTab] = useState<KardexTab>('stock');

  // Filtros de Kardex Valorizado
  const [filters, setFilters] = useState({
    sku: '',
    warehouse: '',
    start_date: firstDay(),
    end_date: today(),
    operation: '',
  });

  // Filtros de Caja y Bancos
  const [cashFilters, setCashFilters] = useState({
    start_date: firstDay(),
    end_date: today(),
    direction: '',
  });

  // Query 1: Kardex Valorizado (Stock - PLE 13.1)
  const kardex = useQuery({
    queryKey: [
      'inventory',
      'kardex',
      filters.sku,
      filters.warehouse,
      filters.start_date,
      filters.end_date,
      filters.operation,
    ],
    queryFn: () =>
      inventoryLedgerApi.getKardex({
        sku: filters.sku.trim() || undefined,
        warehouse: filters.warehouse || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        operation: filters.operation || undefined,
      }),
    enabled: activeTab === 'stock',
  });

  // Query 2: Caja y Bancos (Dinero - § 8.2)
  const cash = useQuery({
    queryKey: ['inventory', 'kardex-cash', cashFilters.start_date, cashFilters.end_date, cashFilters.direction],
    queryFn: () =>
      inventoryLedgerApi.getCashAndBanks({
        start_date: cashFilters.start_date || undefined,
        end_date: cashFilters.end_date || undefined,
        direction: cashFilters.direction || undefined,
      }),
    enabled: activeTab === 'cash',
  });

  // Query 3: Consolidado (Resumen - § 8.2)
  const consolidated = useQuery({
    queryKey: ['inventory', 'kardex-consolidated'],
    queryFn: () => inventoryLedgerApi.getConsolidated(),
    enabled: activeTab === 'consolidated',
  });

  // Query 4: Almacenes dinámicos
  const warehousesQuery = useQuery({
    queryKey: ['inventory', 'warehouses'],
    queryFn: inventoryLedgerApi.getWarehouses,
  });

  // Query 5: Catálogo de productos para autocompletado de SKU
  const stocksQuery = useQuery({
    queryKey: ['inventory', 'stocks'],
    queryFn: inventoryApi.getStockBalances,
  });

  const warehouseList = warehousesQuery.data ?? [];
  const catalogList = stocksQuery.data?.balances ?? [];

  const data = kardex.data;
  const movements = data?.movements ?? [];

  const handleExportCsv = () => {
    if (!movements || movements.length === 0) return;
    const headers = [
      'Fecha',
      'Correlativo',
      'Operacion',
      'Tipo Doc',
      'Serie',
      'Numero',
      'Almacen',
      'SKU',
      'Descripcion',
      'Sentido',
      'Cantidad',
      'Costo Unitario (S/)',
      'Costo Total (S/)',
      'Stock Resultante',
      'Costo Promedio (S/)',
      'Valor Total (S/)',
    ];

    const rows = movements.map((m) => [
      `"${m.date ? String(m.date).slice(0, 10) : ''}"`,
      `"${m.movementNumber}"`,
      `"${m.operationTypeCode} - ${m.operationLabel}"`,
      `"${m.documentTypeCode || ''}"`,
      `"${m.documentSerial || ''}"`,
      `"${numeroDocumentoSinSerie(m.documentSerial, m.documentNumber)}"`,
      `"${m.warehouseCode}"`,
      `"${m.sku}"`,
      `"${m.description.replace(/"/g, '""')}"`,
      `"${m.direction}"`,
      m.quantity,
      m.unitCost.toFixed(4),
      m.totalCost.toFixed(2),
      m.resultingStock.toFixed(2),
      m.resultingAverageCost.toFixed(4),
      m.resultingTotalValue.toFixed(2),
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Kardex_${filters.start_date || 'inicio'}_a_${filters.end_date || 'fin'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCashCsv = () => {
    const cashItems = cash.data?.items ?? [];
    if (!cashItems.length) return;
    const headers = ['Fecha', 'Tipo', 'Documento', 'Contraparte', 'Concepto', 'Entidad_Bancaria', 'Medio_Pago', 'Ingreso_PEN', 'Egreso_PEN'];
    const rows = cashItems.map((c) => [
      `"${c.date}"`,
      `"${c.direction}"`,
      `"${c.documentReference || ''}"`,
      `"${c.counterpartName.replace(/"/g, '""')}"`,
      `"${c.concept.replace(/"/g, '""')}"`,
      `"${c.bankName || ''}"`,
      `"${c.paymentMethod || ''}"`,
      c.direction === 'INGRESO' ? c.amount.toFixed(2) : '0.00',
      c.direction === 'EGRESO' ? c.amount.toFixed(2) : '0.00',
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Tesoreria_Caja_Bancos_${cashFilters.start_date}_a_${cashFilters.end_date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportConsolidatedCsv = () => {
    const products = consolidated.data?.products ?? [];
    if (!products.length) return;
    const headers = ['SKU', 'Descripcion', 'Unidad', 'Stock_Global', 'Costo_Promedio_PEN', 'Valor_Total_PEN', 'Desglose_Almacenes'];
    const rows = products.map((p) => [
      `"${p.sku}"`,
      `"${p.description.replace(/"/g, '""')}"`,
      `"${p.unitCode}"`,
      p.totalStock.toFixed(2),
      p.averageUnitCost.toFixed(4),
      p.totalValue.toFixed(2),
      `"${p.warehouses.map((w) => `${w.warehouseCode}: ${w.stock} un. (S/ ${w.totalValue})`).join(' | ')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Inventario_Consolidado_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Page>
      <KardexTabs />
      <PageHeader
        title="Libro de Kardex e Inventario Integral"
        description="Gestión oficial PLE 13.1, control de flujos de dinero en tesorería y consolidado de existencias valorizadas."
      >
        <div className="flex items-center gap-2">
          {activeTab === 'stock' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!movements.length}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          )}
          {activeTab === 'cash' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCashCsv}
              disabled={!(cash.data?.items?.length)}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar Tesorería CSV
            </Button>
          )}
          {activeTab === 'consolidated' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportConsolidatedCsv}
              disabled={!(consolidated.data?.products?.length)}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar Consolidado CSV
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'stock') kardex.refetch();
              if (activeTab === 'cash') cash.refetch();
              if (activeTab === 'consolidated') consolidated.refetch();
            }}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      </PageHeader>

      {/* Selector de 3 Pestañas según Plan de Implementación § 8.2 */}
      <div className="flex border-b border-border bg-card rounded-t-lg p-1 gap-1">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'stock'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Kardex Valorizado (Stock PLE 13.1)
        </button>
        <button
          onClick={() => setActiveTab('cash')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'cash'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Wallet className="h-4 w-4" />
          Caja y Bancos (Dinero)
        </button>
        <button
          onClick={() => setActiveTab('consolidated')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'consolidated'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Consolidado (Resumen)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: KARDEX VALORIZADO (STOCK)                                     */}
      {/* ========================================================================= */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <Card className="p-3">
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="mb-1 font-medium">Producto / SKU</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 font-mono uppercase"
                    placeholder="SKU o Código"
                    list="kardex-catalog-skus"
                    value={filters.sku}
                    onChange={(e) => setFilters({ ...filters, sku: e.target.value })}
                  />
                  <datalist id="kardex-catalog-skus">
                    {catalogList.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku} · {p.description}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium">Almacén</p>
                <select
                  aria-label="Filtrar por Almacén"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={filters.warehouse}
                  onChange={(e) => setFilters({ ...filters, warehouse: e.target.value })}
                >
                  <option value="">Todos los almacenes (Consolidado)</option>
                  {warehouseList.map((w) => (
                    <option key={w.warehouse_code} value={w.warehouse_code}>
                      {w.warehouse_code} — {w.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 font-medium">Desde</p>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div>
                <p className="mb-1 font-medium">Hasta</p>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
              <div>
                <p className="mb-1 font-medium">Operación (Tabla 12 SUNAT)</p>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={filters.operation}
                  onChange={(e) => setFilters({ ...filters, operation: e.target.value })}
                >
                  <option value="">Todas las operaciones</option>
                  <option value="16">16 — Saldo inicial</option>
                  <option value="02">02 — Compra Nacional</option>
                  <option value="01">01 — Venta Nacional (Factura)</option>
                  <option value="18">18 — Importación (DAM Tipo 50)</option>
                  <option value="05">05 — Devolución (Nota de Crédito)</option>
                  <option value="21">21 — Transferencia entrada</option>
                  <option value="22">22 — Transferencia salida</option>
                  <option value="28">28 — Ajuste físico</option>
                </select>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Saldo inicial</p>
              <p className="mt-1 text-xl font-bold font-mono">{data ? data.opening.stock.toFixed(2) : '—'}</p>
              <p className="text-xs text-muted-foreground">{data ? money(data.opening.totalValue) : ''}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Entradas del periodo</p>
              <p className="mt-1 text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {data ? data.totals.entriesQuantity.toFixed(2) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{data ? money(data.totals.entries) : ''}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Salidas del periodo</p>
              <p className="mt-1 text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {data ? data.totals.exitsQuantity.toFixed(2) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{data ? money(data.totals.exits) : ''}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Transferencias internas</p>
              <p className="mt-1 text-xl font-bold font-mono text-sky-600 dark:text-sky-400">
                {data ? data.internalTransfers.count : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {data
                  ? `Entradas ${data.internalTransfers.entriesQuantity.toFixed(2)} · Salidas ${data.internalTransfers.exitsQuantity.toFixed(2)}`
                  : ''}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Saldo final</p>
              <p className="mt-1 text-xl font-bold font-mono text-primary">
                {data ? data.final.stock.toFixed(2) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{data ? money(data.final.totalValue) : ''}</p>
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase">
                <tr>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Operación SUNAT</th>
                  <th className="p-2">Documento</th>
                  <th className="p-2">Producto</th>
                  <th className="p-2">Almacén</th>
                  <th className="p-2 text-right">Entrada</th>
                  <th className="p-2 text-right">Salida</th>
                  <th className="p-2 text-right">Saldo</th>
                  <th className="p-2 text-right">Costo prom.</th>
                  <th className="p-2 text-right">Valor total</th>
                </tr>
              </thead>
              <tbody>
                {kardex.isLoading ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">
                      Cargando Kardex...
                    </td>
                  </tr>
                ) : (
                  <>
                    {data && (
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="p-2">—</td>
                        <td className="p-2">Saldo inicial</td>
                        <td className="p-2">—</td>
                        <td className="p-2">—</td>
                        <td className="p-2">—</td>
                        <td className="p-2 text-right">—</td>
                        <td className="p-2 text-right">—</td>
                        <td className="p-2 text-right">{data.opening.stock.toFixed(2)}</td>
                        <td className="p-2 text-right">{data.opening.unitCost.toFixed(4)}</td>
                        <td className="p-2 text-right">{money(data.opening.totalValue)}</td>
                      </tr>
                    )}
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-muted-foreground">
                          No hay movimientos registrados en el periodo seleccionado.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr
                          key={m.id}
                          className={
                            m.isInternalTransfer
                              ? 'border-t bg-sky-500/5 text-muted-foreground'
                              : 'border-t hover:bg-muted/20'
                          }
                        >
                          <td className="p-2 font-mono">{String(m.date).slice(0, 10)}</td>
                          <td className="p-2">
                            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                              {m.operationTypeCode}
                            </span>{' '}
                            <span className="font-medium">{m.operationLabel}</span>
                            {m.isInternalTransfer && (
                              <Badge variant="outline" className="ml-1 text-[9px]">
                                Interna
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 font-mono">
                            {m.documentTypeCode ? `[${m.documentTypeCode}] ` : ''}
                            {formatearReferenciaDocumento(m.documentSerial, m.documentNumber || m.movementNumber)}
                          </td>
                          <td className="p-2">
                            <p className="font-mono font-bold text-primary">{m.sku}</p>
                            <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                              {m.description}
                            </p>
                          </td>
                          <td className="p-2 font-semibold">{m.warehouseCode}</td>
                          <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {m.direction === 'ENTRADA' ? m.quantity.toFixed(2) : '—'}
                          </td>
                          <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">
                            {m.direction === 'SALIDA' ? m.quantity.toFixed(2) : '—'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold">
                            {data?.mode === 'CONSOLIDATED' ? (
                              <div>
                                <span>{m.balanceAfter.toFixed(2)}</span>
                                <span className="block text-[10px] text-muted-foreground font-normal">
                                  {m.warehouseCode}: {m.resultingStock.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              m.resultingStock.toFixed(2)
                            )}
                          </td>
                          <td className="p-2 text-right font-mono">{m.resultingAverageCost.toFixed(4)}</td>
                          <td className="p-2 text-right font-mono font-semibold">
                            {money(m.resultingTotalValue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </>
                )}
              </tbody>
              {data && (
                <tfoot className="bg-muted/40 font-semibold">
                  <tr>
                    <td className="p-2" colSpan={5}>
                      {data.mode === 'CONSOLIDATED'
                        ? `Totales consolidados · ${data.totals.count} movimientos`
                        : `Totales del almacén · ${data.totals.count} movimientos`}
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {data.totals.entriesQuantity.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400">
                      {data.totals.exitsQuantity.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono font-bold">{data.final.stock.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">{data.final.unitCost.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono font-bold">{money(data.final.totalValue)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: CAJA Y BANCOS (DINERO) - § 8.2                                  */}
      {/* ========================================================================= */}
      {activeTab === 'cash' && (
        <div className="space-y-4">
          <Card className="p-3">
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div>
                <p className="mb-1 font-medium">Sentido de Flujo</p>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={cashFilters.direction}
                  onChange={(e) => setCashFilters({ ...cashFilters, direction: e.target.value })}
                >
                  <option value="">Todos los movimientos</option>
                  <option value="INGRESO">Ingresos (Cobros de clientes)</option>
                  <option value="EGRESO">Egresos (Pagos y Tributos)</option>
                </select>
              </div>
              <div>
                <p className="mb-1 font-medium">Desde</p>
                <Input
                  type="date"
                  value={cashFilters.start_date}
                  onChange={(e) => setCashFilters({ ...cashFilters, start_date: e.target.value })}
                />
              </div>
              <div>
                <p className="mb-1 font-medium">Hasta</p>
                <Input
                  type="date"
                  value={cashFilters.end_date}
                  onChange={(e) => setCashFilters({ ...cashFilters, end_date: e.target.value })}
                />
              </div>
            </div>
          </Card>

          {/* Tarjetas de Tesorería */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                  Total Ingresos (Cobros)
                </p>
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {money(cash.data?.totals.totalIngresos ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Facturas cobradas a clientes</p>
            </Card>

            <Card className="p-4 bg-amber-500/5 border-amber-500/20">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                  Total Egresos (Pagos)
                </p>
                <ArrowDownLeft className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-1 text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
                {money(cash.data?.totals.totalEgresos ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Proveedores y Tributos Aduaneros CDA</p>
            </Card>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase text-primary">
                  Saldo Neto de Tesorería
                </p>
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-2xl font-bold font-mono text-primary">
                {money(cash.data?.totals.netBalance ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Posición monetaria acumulada</p>
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase">
                <tr>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Documento</th>
                  <th className="p-2">Contraparte</th>
                  <th className="p-2">Concepto</th>
                  <th className="p-2">Entidad Bancaria</th>
                  <th className="p-2 text-right">Ingreso (+S/)</th>
                  <th className="p-2 text-right">Egreso (-S/)</th>
                  <th className="p-2 text-right">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {cash.isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      Cargando movimientos de tesorería...
                    </td>
                  </tr>
                ) : (cash.data?.items.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">
                      No se registran movimientos de caja y bancos en el periodo.
                    </td>
                  </tr>
                ) : (
                  cash.data?.items.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-muted/20">
                      <td className="p-2 font-mono">{item.date}</td>
                      <td className="p-2">
                        <Badge
                          variant={item.direction === 'INGRESO' ? 'default' : 'secondary'}
                          className={
                            item.direction === 'INGRESO'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-600 text-white'
                          }
                        >
                          {item.direction}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono font-medium">{item.documentReference || '—'}</td>
                      <td className="p-2 font-semibold text-foreground">{item.counterpartName}</td>
                      <td className="p-2 max-w-[280px] truncate text-muted-foreground">{item.concept}</td>
                      <td className="p-2 font-mono text-[11px]">
                        {item.bankName ? `${item.bankName} (${item.paymentMethod})` : item.paymentMethod}
                      </td>
                      <td className="p-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.direction === 'INGRESO' ? money(item.amount) : '—'}
                      </td>
                      <td className="p-2 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {item.direction === 'EGRESO' ? money(item.amount) : '—'}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">{money(item.runningBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: CONSOLIDADO (RESUMEN EJECUTIVO) - § 8.2                         */}
      {/* ========================================================================= */}
      {activeTab === 'consolidated' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Productos Controlados
                </p>
                <Package className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-2xl font-bold font-mono">
                {consolidated.data?.totalProducts ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Existencias activas en catálogo</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Stock Total Global
                </p>
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {(consolidated.data?.totalStockGlobal ?? 0).toFixed(2)} unidades
              </p>
              <p className="text-xs text-muted-foreground mt-1">Suma consolidada en todos los almacenes</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Valor Total en Libros
                </p>
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-2xl font-bold font-mono text-primary">
                {money(consolidated.data?.totalValueGlobal ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Valorización al costo promedio ponderado</p>
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Descripción del Producto</th>
                  <th className="p-2">Unidad</th>
                  <th className="p-2 text-right">Stock Global</th>
                  <th className="p-2 text-right">Costo Promedio (S/)</th>
                  <th className="p-2 text-right">Valor Total (S/)</th>
                  <th className="p-2">Desglose por Almacén</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Cargando existencias consolidadas...
                    </td>
                  </tr>
                ) : (consolidated.data?.products.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No hay productos registrados en el inventario.
                    </td>
                  </tr>
                ) : (
                  consolidated.data?.products.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/20">
                      <td className="p-2 font-mono font-bold text-primary">{p.sku}</td>
                      <td className="p-2 font-medium">{p.description}</td>
                      <td className="p-2 font-mono text-[11px]">{p.unitCode}</td>
                      <td className="p-2 text-right font-mono font-bold text-foreground">
                        {p.totalStock.toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-mono font-semibold">
                        S/ {p.averageUnitCost.toFixed(4)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-primary">
                        {money(p.totalValue)}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {p.warehouses.map((w) => (
                            <Badge key={w.warehouseCode} variant="outline" className="text-[10px]">
                              {w.warehouseCode}: {w.stock.toFixed(2)} un. ({money(w.totalValue)})
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Nota normativa al pie */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
        <BookOpen className="h-3.5 w-3.5" />
        <span>
          Estructura conforme al Plan de Implementación § 8.2: El Kardex Valorizado genera el archivo PLE 13.1
          conforme a SUNAT; los movimientos de Caja y Bancos registran la tesorería de cobros, pagos y tributos
          sin contaminar las unidades físicas de existencias.
        </span>
      </div>
    </Page>
  );
}
