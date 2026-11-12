import { formatearReferenciaDocumento, numeroDocumentoSinSerie } from '../lib/documentReference';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inventoryApi } from '../services/inventoryApi';
import { KardexTabs } from '../components/KardexTabs';
import { type KardexLedgerResponse, type InventoryBalance } from '../types/inventory.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Search, Download, RefreshCw, Warehouse } from 'lucide-react';

const OPERATION_TAGS: Record<string, { label: string; color: string }> = {
  '01': { label: '01 Venta Nacional', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  '02': { label: '02 Compra Nacional', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  '16': { label: '16 Saldo Inicial', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  '18': { label: '18 Importación DAM', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  '21': { label: '21 Transf. Entrada', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
  '22': { label: '22 Transf. Salida', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  '28': { label: '28 Ajuste Físico', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
};

export default function ProductKardexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSku = searchParams.get('sku') || '';

  const [skuInput, setSkuInput] = useState(initialSku);
  const [kardexData, setKardexData] = useState<KardexLedgerResponse | null>(null);
  const [catalog, setCatalog] = useState<InventoryBalance[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [metodo, setMetodo] = useState<'PROMEDIO' | 'FIFO'>('PROMEDIO');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCatalog = async () => {
    try {
      const res = await inventoryApi.getStockBalances();
      setCatalog(res.balances || []);
      if (!initialSku && res.balances && res.balances.length > 0) {
        const firstSku = res.balances[0].sku;
        setSkuInput(firstSku);
        fetchKardex(firstSku);
      }
    } catch {
      // Ignorar error silencioso
    }
  };

  const fetchKardex = async (skuToSearch: string, metodoCosto: 'PROMEDIO' | 'FIFO' = metodo) => {
    if (!skuToSearch.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await inventoryApi.getKardexBySku(skuToSearch.trim().toUpperCase(), { metodo: metodoCosto });
      setKardexData(data);
      setSearchParams({ sku: skuToSearch.trim().toUpperCase() });
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Producto no encontrado en inventario.');
      setKardexData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    if (initialSku) {
      fetchKardex(initialSku);
    }
  }, [initialSku]);

  // Obtener almacenes únicos para el filtro
  const allMovements = kardexData?.movements || [];
  const warehouseOptions = Array.from(
    new Set(allMovements.map((m) => m.warehouseCode).filter((w): w is string => Boolean(w)))
  );

  const displayedMovements = allMovements.filter((m) => {
    if (warehouseFilter !== 'ALL' && m.warehouseCode !== warehouseFilter) {
      return false;
    }
    return true;
  });

  // Totales acumulados para el pie de tabla
  const totalEntriesQty = displayedMovements
    .filter((m) => m.direction === 'ENTRADA')
    .reduce((acc, m) => acc + m.quantity, 0);

  const totalEntriesVal = displayedMovements
    .filter((m) => m.direction === 'ENTRADA')
    .reduce((acc, m) => acc + m.totalCost, 0);

  const totalExitsQty = displayedMovements
    .filter((m) => m.direction === 'SALIDA')
    .reduce((acc, m) => acc + m.quantity, 0);

  const totalExitsVal = displayedMovements
    .filter((m) => m.direction === 'SALIDA')
    .reduce((acc, m) => acc + m.totalCost, 0);

  // Valores de cabecera: usar summary del backend si existe, o calcular del stock consolidado
  const currentTotalStock =
    kardexData?.summary?.totalStock ??
    displayedMovements.slice(-1)[0]?.resultingStock ??
    0;

  const currentAverageCost =
    kardexData?.summary?.averageCost ??
    displayedMovements.slice(-1)[0]?.resultingAverageCost ??
    0;

  const currentTotalValuation =
    kardexData?.summary?.totalValuation ??
    displayedMovements.slice(-1)[0]?.resultingTotalValue ??
    0;

  const handleExportCsv = () => {
    if (!displayedMovements.length || !kardexData) return;
    const headers = [
      'Fecha',
      'Operacion_SUNAT',
      'Tipo_Doc',
      'Serie',
      'Numero',
      'Almacen',
      'SKU',
      'Descripcion',
      'Sentido',
      'Entrada_Cantidad',
      'Entrada_Costo_Unit',
      'Entrada_Total',
      'Salida_Cantidad',
      'Salida_Costo_Unit',
      'Salida_Total',
      'Saldo_Cantidad',
      'Saldo_Costo_Promedio',
      'Saldo_Total_Valuado',
    ];

    const rows = displayedMovements.map((m) => {
      const isEntry = m.direction === 'ENTRADA';
      const docParts = (m.documentNumber || '').split('-');
      const docSerial = m.documentSerial || docParts[0] || '';
      const docNum = numeroDocumentoSinSerie(docSerial, m.documentNumber || m.movementNumber);

      return [
        `"${new Date(m.movementDate).toLocaleDateString('es-PE')}"`,
        `"${m.operationTypeCode}"`,
        `"${m.documentTypeCode || '00'}"`,
        `"${docSerial}"`,
        `"${docNum}"`,
        `"${m.warehouseCode || 'ALM-01'}"`,
        `"${kardexData.product.sku}"`,
        `"${kardexData.product.description.replace(/"/g, '""')}"`,
        `"${m.direction}"`,
        isEntry ? m.quantity.toFixed(2) : '0.00',
        isEntry ? m.unitCost.toFixed(4) : '0.0000',
        isEntry ? m.totalCost.toFixed(2) : '0.00',
        !isEntry ? m.quantity.toFixed(2) : '0.00',
        !isEntry ? m.unitCost.toFixed(4) : '0.0000',
        !isEntry ? m.totalCost.toFixed(2) : '0.00',
        m.resultingStock.toFixed(2),
        m.resultingAverageCost.toFixed(4),
        m.resultingTotalValue.toFixed(2),
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kardex_${kardexData.product.sku}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <KardexTabs />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Kardex Permanente Valorizado
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Formato PLE 13.1
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Control perpetuo por producto con método de costo promedio o FIFO (NIC 2).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Selector rápido de catálogo */}
          {catalog.length > 0 && (
            <select
              aria-label="Seleccionar Producto del Catálogo"
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium max-w-[220px]"
              value={skuInput}
              onChange={(e) => {
                const sku = e.target.value;
                setSkuInput(sku);
                fetchKardex(sku);
              }}
            >
              <option value="">-- Seleccionar Producto --</option>
              {catalog.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} · {p.description.slice(0, 30)}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <Input
              placeholder="SKU..."
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchKardex(skuInput)}
              className="w-28 text-xs uppercase font-mono"
            />
            <Button
              onClick={() => fetchKardex(skuInput)}
              disabled={isLoading || !skuInput.trim()}
              size="sm"
              className="gap-1 text-xs"
            >
              {isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Consultar
            </Button>
          </div>

          <select
            aria-label="Método de costeo"
            value={metodo}
            onChange={(e) => {
              const valor = e.target.value as 'PROMEDIO' | 'FIFO';
              setMetodo(valor);
              if (skuInput.trim()) void fetchKardex(skuInput, valor);
            }}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
          >
            <option value="PROMEDIO">Costo promedio</option>
            <option value="FIFO">Costo FIFO</option>
          </select>

          {kardexData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {errorMessage}
        </div>
      )}

      {kardexData && (
        <>
          {/* Ficha Resumen de Cabecera */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Producto</p>
                <p className="text-lg font-bold text-primary mt-1 font-mono">{kardexData.product.sku}</p>
                <p className="text-xs text-muted-foreground truncate" title={kardexData.product.description}>
                  {kardexData.product.description}
                </p>
                {kardexData.summary?.warehouseBalances && kardexData.summary.warehouseBalances.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {kardexData.summary.warehouseBalances.map((w) => (
                      <Badge key={w.warehouseCode} variant="outline" className="text-[10px] py-0 px-1">
                        {w.warehouseCode}: {w.stock.toFixed(2)} un.
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Existencias Físicas Totales</p>
                <p className="text-2xl font-bold mt-1">
                  {currentTotalStock.toLocaleString('es-PE', { minimumFractionDigits: 2 })}{' '}
                  <span className="text-xs text-muted-foreground font-normal">
                    {kardexData.product.sunatUnitCode || 'NIU'}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {warehouseFilter === 'ALL'
                    ? 'Consolidado en todos los almacenes'
                    : `Stock en almacén ${warehouseFilter}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Costo Promedio Móvil (CPP)</p>
                <p className="text-2xl font-bold mt-1 text-primary font-mono">
                  S/ {currentAverageCost.toFixed(4)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Valuación perpetua Art. 35 LIR</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Valor Total Acumulado</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
                  S/ {currentTotalValuation.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Saldo en libros contables</p>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Filtros de la Tabla */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-muted/20 p-2.5 rounded-lg border">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase text-muted-foreground">Filtrar por Almacén:</span>
              <select
                aria-label="Filtrar movimientos por almacén"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
              >
                <option value="ALL">Todos los Almacenes (Consolidado)</option>
                {warehouseOptions.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-muted-foreground">
              Mostrando <strong>{displayedMovements.length}</strong> movimiento(s)
            </span>
          </div>

          {/* Tabla de 3 Bloques PLE 13.1 */}
          <div className="border rounded-md bg-card overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/70 text-center font-bold text-muted-foreground uppercase">
                  <th colSpan={5} className="p-2 border-r">Documento de Sustento</th>
                  <th colSpan={3} className="p-2 border-r bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    Entradas
                  </th>
                  <th colSpan={3} className="p-2 border-r bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    Salidas
                  </th>
                  <th colSpan={3} className="p-2 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    Saldo Acumulado
                  </th>
                </tr>
                <tr className="border-b bg-muted/40 text-muted-foreground uppercase text-[11px]">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Almacén</th>
                  <th className="p-2">Operación</th>
                  <th className="p-2">Comprobante</th>
                  <th className="p-2 border-r whitespace-nowrap">Número</th>

                  {/* Entradas */}
                  <th className="p-2 text-right">Cantidad</th>
                  <th className="p-2 text-right">Costo U.</th>
                  <th className="p-2 text-right border-r">Total</th>

                  {/* Salidas */}
                  <th className="p-2 text-right">Cantidad</th>
                  <th className="p-2 text-right">Costo U.</th>
                  <th className="p-2 text-right border-r">Total</th>

                  {/* Saldo */}
                  <th className="p-2 text-right">Cantidad</th>
                  <th className="p-2 text-right">Promedio Móvil</th>
                  <th className="p-2 text-right font-bold">Total Valuado</th>
                </tr>
              </thead>
              <tbody>
                {displayedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-6 text-center text-muted-foreground">
                      No hay asientos registrados para este producto en el almacén seleccionado.
                    </td>
                  </tr>
                ) : (
                  displayedMovements.map((m) => {
                    const isEntry = m.direction === 'ENTRADA';
                    const opTag = OPERATION_TAGS[m.operationTypeCode] || {
                      label: `T.${m.operationTypeCode}`,
                      color: 'bg-muted text-foreground border-border',
                    };

                    return (
                      <tr key={m.id || m.movementNumber} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-mono">
                          {new Date(m.movementDate).toLocaleDateString('es-PE')}
                        </td>
                        <td className="p-2 font-semibold font-mono text-primary">
                          {m.warehouseCode || 'ALM-01'}
                        </td>
                        <td className="p-2">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${opTag.color}`}
                          >
                            {opTag.label}
                          </span>
                        </td>
                        <td className="p-2 font-mono">{m.documentTypeCode ? `[${m.documentTypeCode}]` : '-'}</td>
                        <td className="p-2 font-mono border-r whitespace-nowrap">
                          {formatearReferenciaDocumento(m.documentSerial, m.documentNumber || m.movementNumber)}
                        </td>

                        {/* Entradas */}
                        <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {isEntry ? m.quantity.toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {isEntry ? `S/ ${m.unitCost.toFixed(4)}` : '-'}
                        </td>
                        <td className="p-2 text-right font-mono border-r font-semibold text-emerald-600 dark:text-emerald-400">
                          {isEntry ? `S/ ${m.totalCost.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '-'}
                        </td>

                        {/* Salidas */}
                        <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400">
                          {!isEntry ? m.quantity.toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {!isEntry ? `S/ ${m.unitCost.toFixed(4)}` : '-'}
                        </td>
                        <td className="p-2 text-right font-mono border-r font-semibold text-amber-600 dark:text-amber-400">
                          {!isEntry ? `S/ ${m.totalCost.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '-'}
                        </td>

                        {/* Saldo Acumulado */}
                        <td className="p-2 text-right font-mono font-bold text-primary">
                          {m.resultingStock.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right font-mono">
                          S/ {m.resultingAverageCost.toFixed(4)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          S/ {m.resultingTotalValue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {displayedMovements.length > 0 && (
                <tfoot className="bg-muted/50 font-bold border-t-2">
                  <tr>
                    <td colSpan={5} className="p-2 text-right uppercase text-[11px] text-muted-foreground">
                      Totales del Periodo:
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {totalEntriesQty.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right font-mono text-muted-foreground">—</td>
                    <td className="p-2 text-right font-mono border-r text-emerald-600 dark:text-emerald-400">
                      S/ {totalEntriesVal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400">
                      {totalExitsQty.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right font-mono text-muted-foreground">—</td>
                    <td className="p-2 text-right font-mono border-r text-amber-600 dark:text-amber-400">
                      S/ {totalExitsVal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-2 text-right font-mono text-primary">
                      {currentTotalStock.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right font-mono">
                      S/ {currentAverageCost.toFixed(4)}
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      S/ {currentTotalValuation.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {!kardexData && !isLoading && !errorMessage && (
        <Card className="p-12 text-center text-xs text-muted-foreground border-dashed">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
          <p className="font-semibold text-foreground text-sm">Consulte el Kardex Valorizado por Producto</p>
          <p className="mt-1 max-w-sm mx-auto">
            Seleccione un producto en el menú desplegable superior o ingrese un código SKU para auditar su libro perpetuo.
          </p>
        </Card>
      )}
    </div>
  );
}
