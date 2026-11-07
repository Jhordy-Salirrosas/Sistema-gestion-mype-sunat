import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Page,
  PageHeader,
  Button,
  Card,
  Input,
  Badge,
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui';
import {
  BookOpen,
  Plus,
  Save,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  Boxes,
  DollarSign,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { inventoryLedgerApi } from '../services/inventoryLedgerApi';
import { inventoryApi } from '../services/inventoryApi';
import { type InventoryMovement } from '../types/inventory.types';

const today = () => new Date().toISOString().slice(0, 10);

const apiError = (error: unknown): string => {
  const err = error as { response?: { data?: { message?: unknown } }; message?: string };
  const message = err.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  if (typeof message === 'string') return message;
  return err.message || 'No se pudo cargar el saldo inicial.';
};

export default function InventoryOpeningPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    openingDate: today(),
    warehouseCode: 'ALM-01',
    notes: '',
  });
  const [items, setItems] = useState([{ sku: '', quantity: 0, unitCost: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const warehouses = useQuery({
    queryKey: ['inventory', 'warehouses'],
    queryFn: inventoryLedgerApi.getWarehouses,
  });

  const stocksQuery = useQuery({
    queryKey: ['inventory', 'stocks'],
    queryFn: inventoryApi.getStockBalances,
  });

  const movementsQuery = useQuery<{ total: number; items: InventoryMovement[] }>({
    queryKey: ['inventory', 'movements'],
    queryFn: () => inventoryApi.listMovements(),
  });

  const catalogProducts = stocksQuery.data?.balances ?? [];

  // Saldos iniciales ya registrados en el sistema (Operación 16)
  const openingMovements: InventoryMovement[] = (movementsQuery.data?.items ?? []).filter(
    (m: InventoryMovement) => m.operationTypeCode === '16'
  );

  const filteredOpeningMovements = openingMovements.filter((m: InventoryMovement) => {
    if (!historySearchTerm.trim()) return true;
    const term = historySearchTerm.toLowerCase();
    const sku = (m.sku || '').toLowerCase();
    const desc = (m.description || '').toLowerCase();
    const num = (m.movementNumber || '').toLowerCase();
    const wh = (m.warehouseCode || '').toLowerCase();
    return sku.includes(term) || desc.includes(term) || num.includes(term) || wh.includes(term);
  });

  const totalOpeningUnitsRegistered = openingMovements.reduce(
    (acc: number, m: InventoryMovement) => acc + m.quantity,
    0
  );
  const totalOpeningValueRegistered = openingMovements.reduce(
    (acc: number, m: InventoryMovement) => acc + m.totalCost,
    0
  );

  const mutation = useMutation({
    mutationFn: () =>
      inventoryLedgerApi.createOpening({
        ...form,
        items: items
          .filter((i) => i.sku.trim() && i.quantity > 0)
          .map((i) => ({
            sku: i.sku.trim().toUpperCase(),
            quantity: Number(i.quantity),
            unitCost: Number(i.unitCost),
          })),
      }),
    onSuccess: (result: any) => {
      setError(null);
      setSuccess(
        `Saldo inicial cargado exitosamente para ${result.items?.length ?? items.length} producto(s) en ${result.warehouseCode ?? form.warehouseCode}. Asiento contable generado (Op. 16).`
      );
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stocks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'kardex'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] });
      setItems([{ sku: '', quantity: 0, unitCost: 0 }]);
    },
    onError: (e) => {
      setSuccess(null);
      setError(apiError(e));
    },
  });

  const updateItem = (
    index: number,
    patch: Partial<{ sku: string; quantity: number; unitCost: number }>
  ) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      '\uFEFFSKU,Cantidad,CostoUnitario\n' +
      'LAP-001,50,2050.0000\n' +
      'CEM-001,100,25.5000\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_saldo_inicial_sunat.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          alert('El archivo CSV está vacío o solo contiene la cabecera.');
          return;
        }

        const startIndex = isNaN(Number(lines[0].split(',')[1])) ? 1 : 0;
        const parsedItems: { sku: string; quantity: number; unitCost: number }[] = [];

        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.replace(/"/g, '').trim());
          if (parts.length >= 2) {
            const sku = parts[0].toUpperCase();
            const quantity = Number(parts[1]) || 0;
            const unitCost = Number(parts[2]) || 0;
            if (sku && quantity > 0) {
              parsedItems.push({ sku, quantity, unitCost });
            }
          }
        }

        if (parsedItems.length === 0) {
          alert('No se encontraron registros válidos en el archivo CSV.');
          return;
        }

        setItems(parsedItems);
        setSuccess(`Se cargaron ${parsedItems.length} producto(s) desde el archivo CSV listos para aplicar.`);
      } catch (err) {
        console.error('Error parseando CSV:', err);
        alert('Error al leer el archivo CSV. Verifique que el formato sea: SKU,Cantidad,CostoUnitario');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const batchTotalUnits = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const batchTotalValue = items.reduce(
    (acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0),
    0
  );

  return (
    <Page>
      <PageHeader
        title="Saldo inicial de inventario"
        description="Carga del stock y costo de apertura del periodo fiscal (Operación 16 SUNAT / NIC 2)."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          className="gap-1.5"
          title="Descargar plantilla CSV de carga inicial"
        >
          <Download className="h-3.5 w-3.5" />
          Plantilla CSV
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/kardex/producto" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Kardex valorizado
          </Link>
        </Button>
      </PageHeader>

      {/* Tarjetas de Métricas de Apertura Registrada */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Productos con Saldo Inicial</p>
            <p className="text-2xl font-bold mt-1">{openingMovements.length}</p>
          </div>
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Unidades Físicas Aperturadas</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {totalOpeningUnitsRegistered.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600">
            <Boxes className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Valor Total Apertura (PEN)</p>
            <p className="text-2xl font-bold mt-1 text-primary font-mono">
              S/ {totalOpeningValueRegistered.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <DollarSign className="h-5 w-5" />
          </div>
        </Card>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/10 text-xs">
        <AlertTitle className="font-semibold flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" /> Normativa Tributaria SUNAT (Art. 35 LIR / NIC 2)
        </AlertTitle>
        <AlertDescription>
          El saldo inicial se registra con comprobante tipo <strong>[00] Nota Interna / SI</strong> y tipo de operación <strong>16 Saldo Inicial</strong> en el Kardex permanente valorizado (PLE 13.1). Si un producto ya cuenta con saldo de apertura en la misma fecha y almacén, el sistema previene la duplicidad.
        </AlertDescription>
      </Alert>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Formulario de Carga */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Formulario de Carga de Apertura
            </h3>
            <p className="text-xs text-muted-foreground">
              Ingrese los productos individualmente o cargue masivamente desde un archivo CSV.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCsvUpload}
              accept=".csv"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Cargar archivo CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          <div>
            <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Fecha de corte *</p>
            <Input
              type="date"
              value={form.openingDate}
              onChange={(e) => setForm({ ...form, openingDate: e.target.value })}
            />
          </div>
          <div>
            <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Almacén de destino *</p>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.warehouseCode}
              onChange={(e) => setForm({ ...form, warehouseCode: e.target.value })}
            >
              {(warehouses.data ?? [{ warehouse_code: 'ALM-01', description: 'Almacén principal' }]).map((w) => (
                <option key={w.warehouse_code} value={w.warehouse_code}>
                  {w.warehouse_code} — {w.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Observaciones / Sustento</p>
            <Input
              placeholder="ej: Asiento inicial de apertura 2026"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        {/* Tabla de Productos del Lote */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-muted-foreground text-[10px]">
              Productos a Aperturar ({items.length})
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setItems([...items, { sku: '', quantity: 0, unitCost: 0 }])}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" /> Agregar ítem
            </Button>
          </div>

          <div className="border rounded-md overflow-hidden bg-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Código SKU</th>
                  <th className="p-2.5 w-32 text-right">Cantidad</th>
                  <th className="p-2.5 w-36 text-right">Costo Unit. (PEN)</th>
                  <th className="p-2.5 w-36 text-right">Subtotal Valuado (PEN)</th>
                  <th className="p-2.5 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const subtotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
                  const matchedCat = catalogProducts.find((p) => p.sku === item.sku);

                  return (
                    <tr key={index} className="border-t">
                      <td className="p-2">
                        {catalogProducts.length > 0 ? (
                          <div className="space-y-0.5">
                            <input
                              className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-mono"
                              placeholder="SKU (ej. LAP-001)"
                              list={`catalog-skus-${index}`}
                              value={item.sku}
                              onChange={(e) => updateItem(index, { sku: e.target.value })}
                            />
                            <datalist id={`catalog-skus-${index}`}>
                              {catalogProducts.map((p) => (
                                <option key={p.sku} value={p.sku}>
                                  {p.sku} — {p.description}
                                </option>
                              ))}
                            </datalist>
                            {matchedCat && (
                              <p className="text-[10px] text-muted-foreground truncate">{matchedCat.description}</p>
                            )}
                          </div>
                        ) : (
                          <Input
                            placeholder="SKU (ej. CEM-001)"
                            value={item.sku}
                            onChange={(e) => updateItem(index, { sku: e.target.value })}
                            className="h-8 text-xs font-mono"
                          />
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.00"
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                          className="h-8 text-xs text-right font-mono"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          value={item.unitCost || ''}
                          onChange={(e) => updateItem(index, { unitCost: Number(e.target.value) })}
                          className="h-8 text-xs text-right font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        S/ {subtotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={items.length === 1}
                          onClick={() => setItems(items.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/40 font-bold">
                <tr>
                  <td className="p-2.5 uppercase text-[10px] text-muted-foreground">Total del Lote a Cargar:</td>
                  <td className="p-2.5 text-right font-mono text-xs">
                    {batchTotalUnits.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5"></td>
                  <td className="p-2.5 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    S/ {batchTotalValue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || items.every((i) => !i.sku.trim() || i.quantity <= 0)}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {mutation.isPending ? 'Cargando saldo inicial...' : 'Cargar saldo inicial (Op. 16)'}
          </Button>
        </div>
      </Card>

      {/* Historial de Saldos Iniciales Registrados */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              Saldos Iniciales Registrados en el Sistema
            </h3>
            <p className="text-xs text-muted-foreground">
              Historial oficial de asientos de apertura (Op. 16 SUNAT) registrados para esta empresa.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por SKU, correlativo o almacén..."
              value={historySearchTerm}
              onChange={(e) => setHistorySearchTerm(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px]">
              <tr>
                <th className="p-3">Fecha de Corte</th>
                <th className="p-3">Almacén</th>
                <th className="p-3">N° Correlativo</th>
                <th className="p-3">Comprobante</th>
                <th className="p-3">Código SKU</th>
                <th className="p-3">Descripción</th>
                <th className="p-3 text-right">Cantidad Inicial</th>
                <th className="p-3 text-right">Costo Unit. (PEN)</th>
                <th className="p-3 text-right">Total Valuado (PEN)</th>
                <th className="p-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {movementsQuery.isLoading ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-muted-foreground">
                    Cargando historial de saldos iniciales...
                  </td>
                </tr>
              ) : filteredOpeningMovements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-muted-foreground">
                    No se registran saldos iniciales con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredOpeningMovements.map((m: InventoryMovement) => (
                  <tr key={m.id || m.movementNumber} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono">
                      {new Date(m.movementDate).toLocaleDateString('es-PE')}
                    </td>
                    <td className="p-3 font-semibold">{m.warehouseCode || 'ALM-01'}</td>
                    <td className="p-3 font-mono font-semibold text-primary">{m.movementNumber}</td>
                    <td className="p-3 font-mono text-muted-foreground">
                      <span className="text-[10px] px-1 py-0.5 rounded bg-muted/60 text-foreground font-semibold mr-1">
                        [{m.documentTypeCode || '00'}]
                      </span>
                      {m.documentNumber || 'SI-2026'}
                    </td>
                    <td className="p-3 font-mono font-bold text-primary">{m.sku}</td>
                    <td className="p-3 text-foreground">{m.description || '—'}</td>
                    <td className="p-3 text-right font-bold font-mono">
                      {m.quantity.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono">
                      S/ {m.unitCost.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      S/ {m.totalCost.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="default" className="text-[10px] bg-emerald-600">
                        CONFIRMADO
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
        <Save className="h-3.5 w-3.5 text-primary" />
        <span>Los saldos iniciales se registran como operación 16 y constituyen la base del Libro de Inventarios y Balances y PLE 13.1.</span>
      </div>
    </Page>
  );
}
