import { formatearReferenciaDocumento } from '../lib/documentReference';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pleEvaluationSchema, type PleEvaluationFormData } from '../validators/pleExportSchema';
import { inventoryApi } from '../services/inventoryApi';
import { KardexTabs } from '../components/KardexTabs';
import { type InventoryBookObligation, type InventoryMovement } from '../types/inventory.types';
import { PleExportModal } from '../components/PleExportModal';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BookOpen,
  Download,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCheck2,
  FileText,
} from 'lucide-react';

const OPERATION_NAMES: Record<string, string> = {
  '01': '01 Venta Nacional',
  '02': '02 Compra Nacional',
  '16': '16 Saldo Inicial',
  '18': '18 Importación (DAM)',
  '21': '21 Transf. Entrada',
  '22': '22 Transf. Salida',
  '28': '28 Ajuste Físico',
};

export default function ElectronicBooksPage() {
  const activeCompany = useAuthStore((state) => state.activeCompany);
  const currentYear = new Date().getFullYear();
  const [obligation, setObligation] = useState<InventoryBookObligation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
  } = useForm<PleEvaluationFormData>({
    resolver: zodResolver(pleEvaluationSchema),
    defaultValues: {
      fiscal_year: currentYear,
      annual_revenue_uit: 400,
      tax_regime: activeCompany?.regimen === 'GENERAL' ? 'GENERAL' : 'MYPE_TRIBUTARIO',
    },
  });

  const selectedYear = watch('fiscal_year') || currentYear;
  const uitValue = 5350; // UIT 2026

  const loadExistingDecision = async (year: number) => {
    try {
      const data = await inventoryApi.getObligationByYear(year);
      if (data) {
        setObligation(data);
        setValue('annual_revenue_uit', data.annualRevenueUit);
        setValue('tax_regime', data.taxRegime);
      }
    } catch (err) {
      console.error('Error cargando obligatoriedad:', err);
    }
  };

  const loadMovements = async () => {
    setIsLoadingMovements(true);
    try {
      const data = await inventoryApi.listMovements();
      setMovements(data.items || []);
    } catch (err) {
      console.error('Error cargando movimientos para auditoría:', err);
    } finally {
      setIsLoadingMovements(false);
    }
  };

  useEffect(() => {
    loadExistingDecision(currentYear);
    loadMovements();
  }, [currentYear]);

  const onEvaluate = async (data: PleEvaluationFormData) => {
    setIsEvaluating(true);
    try {
      const result = await inventoryApi.evaluateObligation(data);
      setObligation(result);
    } catch (err) {
      console.error('Error evaluando obligatoriedad:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'OBLIGATORIO') {
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/30 gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          OBLIGATORIO
        </Badge>
      );
    }
    if (status === 'EXCEPTUADO') {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          EXCEPTUADO
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        VOLUNTARIO
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <KardexTabs />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Registros Electrónicos PLE 12.1 y 13.1
          </h1>
          <p className="text-sm text-muted-foreground">
            Evaluación jurídica según el Art. 35 del Reglamento de la LIR y exportador oficial de archivos TXT para el PLE de SUNAT.
          </p>
        </div>

        <Button onClick={() => setIsExportModalOpen(true)} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Libro PLE
        </Button>
      </div>

      {/* Bloque 1: Asistente y Diagnóstico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Asistente de Evaluación Legal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Asistente de Obligatoriedad (Art. 35 LIR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onEvaluate)} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground uppercase">Ejercicio Fiscal</label>
                <Input
                  type="number"
                  {...register('fiscal_year', { valueAsNumber: true })}
                  className="mt-1 font-semibold text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground uppercase">
                  Ingresos Brutos Anuales (en UIT) *
                </label>
                <Input
                  type="number"
                  step="any"
                  {...register('annual_revenue_uit', { valueAsNumber: true })}
                  className="mt-1 font-semibold text-sm"
                  placeholder="ej: 400"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  1 UIT {selectedYear} = S/ {uitValue.toLocaleString('es-PE')}. Umbral &gt; 1,500 UIT (S/{' '}
                  {(1500 * uitValue).toLocaleString('es-PE')}) obliga al Kardex Valorizado 13.1.
                </p>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground uppercase">Régimen Tributario *</label>
                <select
                  aria-label="Régimen Tributario"
                  {...register('tax_regime')}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
                >
                  <option value="MYPE_TRIBUTARIO">Régimen MYPE Tributario (RMT)</option>
                  <option value="GENERAL">Régimen General (RG)</option>
                  <option value="RER">Régimen Especial de Renta (RER)</option>
                </select>
              </div>

              <Button type="submit" disabled={isEvaluating} className="w-full gap-2 mt-2">
                {isEvaluating && <Loader2 className="h-4 w-4 animate-spin" />}
                Diagnosticar Obligatoriedad Jurídica
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Dictamen Legal de Libros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Diagnóstico Tributario Oficial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {obligation ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
                    <div>
                      <p className="font-semibold text-sm">PLE 12.1 - Unidades Físicas</p>
                      <p className="text-xs text-muted-foreground">Registro de Unidades Físicas (20 campos normativos)</p>
                    </div>
                    {getStatusBadge(obligation.ple12_1Status)}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
                    <div>
                      <p className="font-semibold text-sm">PLE 13.1 - Permanente Valorizado</p>
                      <p className="text-xs text-muted-foreground">Kardex Perpetuo al Costo Promedio CPP (27 campos)</p>
                    </div>
                    {getStatusBadge(obligation.ple13_1Status)}
                  </div>
                </div>

                <Alert className="text-xs">
                  <Scale className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-semibold">Fundamento Legal:</span> {obligation.legalBasisNotes}
                  </AlertDescription>
                </Alert>

                <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground border-t">
                  <span>Contribuyente: {activeCompany?.razonSocial || 'EMPRESA DEMO'}</span>
                  <span className="font-mono font-semibold">RUC: {activeCompany?.ruc || '20601234567'}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Ingrese los ingresos anuales en UIT para evaluar la exigibilidad de los libros PLE.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bloque 2: Tabla Normativa Art. 35 LIR y Estructuras PLE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Marco Normativo y Estructura Técnica de Libros Electrónicos (SUNAT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Tramo 1: $\le$ 500 UIT</span>
                <Badge variant="outline" className="text-[10px]">Hasta S/ 2,675,000</Badge>
              </div>
              <p className="text-muted-foreground">
                Art. 35 inc. c Reglamento LIR: Solo está obligado a realizar <strong>inventarios físicos anuales</strong> de sus existencias.
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ✓ Exceptuado de llevar registros PLE 12.1 y 13.1 ante SUNAT.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Tramo 2: &gt; 500 a 1,500 UIT</span>
                <Badge variant="outline" className="text-[10px]">Hasta S/ 8,025,000</Badge>
              </div>
              <p className="text-muted-foreground">
                Art. 35 inc. b Reglamento LIR: Obligado a llevar <strong>Registro de Inventario Permanente en Unidades Físicas (PLE 12.1)</strong>.
              </p>
              <p className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                ✓ 20 campos obligatorios. Control físico de entradas, salidas y saldos.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Tramo 3: &gt; 1,500 UIT</span>
                <Badge variant="destructive" className="text-[10px]">Mayor a S/ 8,025,000</Badge>
              </div>
              <p className="text-muted-foreground">
                Art. 35 inc. a Reglamento LIR: Obligado a llevar <strong>Registro de Inventario Permanente Valorizado (PLE 13.1)</strong>.
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                ✓ 27 campos obligatorios. Método de Costo Promedio Ponderado (CPP).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloque 3: Auditoría Previa: Asientos Reales en Base de Datos para el PLE */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              Auditoría Previa: Asientos Registrados en Base de Datos para PLE
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Movimientos inmutables sincronizados que alimentan la estructura de los archivos TXT y Excel de auditoría.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Descargar PLE TXT
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px]">
                <tr>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Correlativo</th>
                  <th className="p-2">Tipo Op. (T.12)</th>
                  <th className="p-2">Comprobante (T.10)</th>
                  <th className="p-2">Almacén</th>
                  <th className="p-2">Producto</th>
                  <th className="p-2 text-right">Cantidad</th>
                  <th className="p-2 text-right">Costo Unitario</th>
                  <th className="p-2 text-right">Total (PEN)</th>
                  <th className="p-2 text-right">Saldo Final</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingMovements ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">
                      Cargando movimientos de inventario desde la base de datos...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">
                      No hay movimientos registrados en la base de datos para exportar.
                    </td>
                  </tr>
                ) : (
                  movements.slice(0, 10).map((m) => (
                    <tr key={m.id} className="border-t hover:bg-muted/20">
                      <td className="p-2 font-mono">{new Date(m.movementDate).toLocaleDateString('es-PE')}</td>
                      <td className="p-2 font-mono font-medium">{m.movementNumber}</td>
                      <td className="p-2">
                        <span className="font-semibold text-foreground">
                          {OPERATION_NAMES[m.operationTypeCode] || `Tipo ${m.operationTypeCode}`}
                        </span>
                      </td>
                      <td className="p-2 font-mono">
                        {m.documentTypeCode ? `[${m.documentTypeCode}] ` : ''}
                        {formatearReferenciaDocumento(m.documentSerial, m.documentNumber || m.movementNumber)}
                      </td>
                      <td className="p-2 font-semibold font-mono text-primary">{m.warehouseCode || 'ALM-01'}</td>
                      <td className="p-2">
                        <span className="font-mono font-bold">{m.sku}</span>{' '}
                        <span className="text-muted-foreground truncate max-w-[140px] inline-block align-bottom">
                          {m.description}
                        </span>
                      </td>
                      <td
                        className={`p-2 text-right font-mono font-semibold ${
                          m.direction === 'ENTRADA'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {m.direction === 'ENTRADA' ? `+${m.quantity.toFixed(2)}` : `-${m.quantity.toFixed(2)}`}
                      </td>
                      <td className="p-2 text-right font-mono">S/ {m.unitCost.toFixed(4)}</td>
                      <td className="p-2 text-right font-mono font-bold">S/ {m.totalCost.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold text-primary">
                        {m.resultingStock.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {movements.length > 10 && (
                <tfoot className="bg-muted/30 text-[11px] text-muted-foreground">
                  <tr>
                    <td colSpan={10} className="p-2 text-center">
                      Mostrando los primeros 10 de <strong>{movements.length}</strong> movimientos registrados en la BD.
                      Haga clic en <strong>"Exportar Libro PLE"</strong> para generar el archivo TXT o Excel completo.
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <PleExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </div>
  );
}
