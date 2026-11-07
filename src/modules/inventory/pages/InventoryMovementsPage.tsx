import { useState, useEffect } from 'react';
import { inventoryApi } from '../services/inventoryApi';
import { type InventoryMovement } from '../types/inventory.types';
import { ManualMovementModal } from '../components/ManualMovementModal';
import { NationalPurchaseModal } from '../components/NationalPurchaseModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeftRight,
  RefreshCw,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ShoppingBag,
  Search,
  Download,
  Filter,
} from 'lucide-react';

const OPERATION_NAMES: Record<string, string> = {
  '01': '01 Venta Nacional',
  '02': '02 Compra Nacional',
  '03': '03 Consignación Recibida',
  '04': '04 Consignación Entregada',
  '05': '05 Devolución Recibida',
  '06': '06 Devolución Entregada',
  '07': '07 Bonificación',
  '08': '08 Premio',
  '09': '09 Donación',
  '10': '10 Salida a Producción',
  '11': '11 Transferencia entre Almacenes',
  '12': '12 Retiro',
  '13': '13 Mermas',
  '14': '14 Desmedros',
  '15': '15 Destrucción',
  '16': '16 Saldo Inicial',
  '17': '17 Exportación',
  '18': '18 Importación (DAM)',
  '19': '19 Entrada de Producción',
  '21': '21 Transferencia (Entrada)',
  '22': '22 Transferencia (Salida)',
  '28': '28 Ajuste Físico',
  '99': '99 Otros',
};

const DOCUMENT_NAMES: Record<string, string> = {
  '00': 'Nota Interna',
  '01': 'Factura',
  '03': 'Boleta',
  '07': 'Nota Crédito',
  '08': 'Nota Débito',
  '09': 'Guía Remisión',
  '12': 'Ticket',
  '50': 'DAM/DUA',
};

export default function InventoryMovementsPage() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOpType, setSelectedOpType] = useState<string>('ALL');
  const [selectedDirection, setSelectedDirection] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const data = await inventoryApi.listMovements();
      setMovements(data.items || []);
    } catch (err) {
      console.error('Error cargando movimientos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshState('loading');
    await loadMovements();
    setRefreshState('success');
    setTimeout(() => setRefreshState('idle'), 1800);
  };

  useEffect(() => {
    loadMovements();
  }, []);

  const warehouseOptions = Array.from(
    new Set(movements.map((m) => m.warehouseCode).filter((w): w is string => Boolean(w)))
  );

  const filteredMovements = movements.filter((m) => {
    if (selectedOpType !== 'ALL' && m.operationTypeCode !== selectedOpType) return false;
    if (selectedDirection !== 'ALL' && m.direction !== selectedDirection) return false;
    if (selectedWarehouse !== 'ALL' && m.warehouseCode !== selectedWarehouse) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const sku = (m.sku || '').toLowerCase();
    const desc = (m.description || '').toLowerCase();
    const num = (m.movementNumber || '').toLowerCase();
    const doc = (m.documentNumber || '').toLowerCase();
    const ser = (m.documentSerial || '').toLowerCase();
    return sku.includes(term) || desc.includes(term) || num.includes(term) || doc.includes(term) || ser.includes(term);
  });

  const totalEntriesQty = filteredMovements
    .filter((m) => m.direction === 'ENTRADA')
    .reduce((acc, m) => acc + m.quantity, 0);

  const totalExitsQty = filteredMovements
    .filter((m) => m.direction === 'SALIDA')
    .reduce((acc, m) => acc + m.quantity, 0);

  const handleExportCsv = () => {
    if (filteredMovements.length === 0) {
      alert('No hay movimientos registrados para exportar.');
      return;
    }
    const headers = [
      'Fecha',
      'Almacen',
      'Correlativo',
      'Tipo Operacion SUNAT (T12)',
      'Tipo Comprobante (T10)',
      'Serie Comprobante',
      'Numero Comprobante',
      'Codigo SKU',
      'Descripcion',
      'Sentido',
      'Cantidad',
      'Costo Unitario PEN',
      'Total Costo PEN',
      'Stock Resultante',
    ];
    const rows = filteredMovements.map((m) => [
      new Date(m.movementDate).toLocaleDateString('es-PE'),
      `"${m.warehouseCode || 'ALM-01'}"`,
      `"${m.movementNumber}"`,
      `"${OPERATION_NAMES[m.operationTypeCode] || `Tipo ${m.operationTypeCode}`}"`,
      `"${DOCUMENT_NAMES[m.documentTypeCode || ''] || m.documentTypeCode || ''}"`,
      `"${m.documentSerial || ''}"`,
      `"${m.documentNumber || ''}"`,
      `"${m.sku}"`,
      `"${(m.description || '').replace(/"/g, '""')}"`,
      `"${m.direction}"`,
      m.quantity,
      m.unitCost.toFixed(4),
      m.totalCost.toFixed(2),
      m.resultingStock,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kardex_movimientos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="h-7 w-7 text-primary" />
            Movimientos de Inventario
          </h1>
          <p className="text-sm text-muted-foreground">
            Asientos inmutables de entradas y salidas clasificados según la Tabla 12 de SUNAT.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5"
            title="Descargar historial de movimientos en CSV"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshState === 'loading'}
            className="gap-1.5 transition-all"
          >
            {refreshState === 'loading' ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span>Actualizando...</span>
              </>
            ) : refreshState === 'success' ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 animate-in zoom-in-50" />
                <span className="text-emerald-500 font-medium">Actualizado</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Actualizar</span>
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => setIsPurchaseModalOpen(true)}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
          >
            <ShoppingBag className="h-4 w-4" />
            Compra Nacional (Op. 02)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsModalOpen(true)} className="gap-1">
            <PlusCircle className="h-4 w-4" />
            Otro Movimiento
          </Button>
        </div>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Movimientos Registrados</p>
              <p className="text-2xl font-bold mt-1">{filteredMovements.length}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full text-primary">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Total Unidades Entradas</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                +{totalEntriesQty.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-600">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">Total Unidades Salidas</p>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                -{totalExitsQty.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-full text-amber-600">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-lg border bg-card/60">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por SKU, descripción, correlativo o documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={selectedOpType}
              onChange={(e) => setSelectedOpType(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">Todas las Operaciones (T.12)</option>
              <option value="01">01 Venta Nacional</option>
              <option value="02">02 Compra Nacional</option>
              <option value="18">18 Importación (DAM)</option>
              <option value="21">21 Transferencia (Entrada)</option>
              <option value="22">22 Transferencia (Salida)</option>
              <option value="28">28 Ajuste Físico</option>
              <option value="16">16 Saldo Inicial</option>
            </select>
          </div>

          <select
            value={selectedDirection}
            onChange={(e) => setSelectedDirection(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">Sentido: Todos</option>
            <option value="ENTRADA">Solo Entradas</option>
            <option value="SALIDA">Solo Salidas</option>
          </select>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">Almacén: Todos</option>
            {warehouseOptions.map((w) => (
              <option key={w} value={w}>
                {w} {w === 'ALM-01' ? '(Principal)' : ''}
              </option>
            ))}
          </select>

          {(searchTerm || selectedOpType !== 'ALL' || selectedDirection !== 'ALL' || selectedWarehouse !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchTerm('');
                setSelectedOpType('ALL');
                setSelectedDirection('ALL');
                setSelectedWarehouse('ALL');
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-md bg-card overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground uppercase text-[11px]">
              <th className="p-3">Fecha</th>
              <th className="p-3">Almacén</th>
              <th className="p-3">Correlativo</th>
              <th className="p-3">Tipo Operación (T.12)</th>
              <th className="p-3">Sustento (T.10)</th>
              <th className="p-3">Producto / SKU</th>
              <th className="p-3">Sentido</th>
              <th className="p-3 text-right">Cantidad</th>
              <th className="p-3 text-right">Costo Unit. (PEN)</th>
              <th className="p-3 text-right">Total (PEN)</th>
              <th className="p-3 text-right">Stock Resultante</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
                  Cargando movimientos de almacén...
                </td>
              </tr>
            ) : filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
                  No se encontraron movimientos registrados con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredMovements.map((m) => {
                const isEntry = m.direction === 'ENTRADA';
                const docLabel = DOCUMENT_NAMES[m.documentTypeCode || ''];
                return (
                  <tr key={m.id || m.movementNumber} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono">
                      {new Date(m.movementDate).toLocaleDateString('es-PE')}
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      {m.warehouseCode || 'ALM-01'}
                    </td>
                    <td className="p-3 font-mono font-semibold text-foreground">{m.movementNumber}</td>
                    <td className="p-3">
                      <span className="font-medium text-foreground">
                        {OPERATION_NAMES[m.operationTypeCode] || `Tipo ${m.operationTypeCode}`}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {m.documentTypeCode && (
                        <span
                          className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-muted font-semibold text-foreground mr-1"
                          title={docLabel || 'Comprobante SUNAT'}
                        >
                          [{m.documentTypeCode} {docLabel ? docLabel.split(' ')[0] : ''}]
                        </span>
                      )}
                      {m.documentSerial ? `${m.documentSerial}-` : ''}
                      {m.documentNumber || '-'}
                    </td>
                    <td className="p-3">
                      <p className="font-mono font-bold text-primary">{m.sku}</p>
                      {m.description && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[190px]" title={m.description}>
                          {m.description}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      {isEntry ? (
                        <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 gap-1 text-[10px] font-semibold">
                          <ArrowDownLeft className="h-3 w-3" />
                          ENTRADA
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/30 gap-1 text-[10px] font-semibold">
                          <ArrowUpRight className="h-3 w-3" />
                          SALIDA
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold">
                      {m.quantity.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono">
                      S/ {m.unitCost.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-foreground">
                      S/ {m.totalCost.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-bold font-mono text-primary">
                      {m.resultingStock.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ManualMovementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadMovements}
      />

      <NationalPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={loadMovements}
      />
    </div>
  );
}

