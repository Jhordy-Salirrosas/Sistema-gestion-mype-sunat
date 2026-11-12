import { numeroDocumentoSinSerie } from '../lib/documentReference';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pleExportSchema, type PleExportFormData } from '../validators/pleExportSchema';
import { inventoryApi } from '../services/inventoryApi';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

interface PleExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTH_OPTIONS = [
  { value: '00', label: '00 - Anual / Cierre (Defecto PLE 13.1)' },
  { value: '01', label: '01 - Enero' },
  { value: '02', label: '02 - Febrero' },
  { value: '03', label: '03 - Marzo' },
  { value: '04', label: '04 - Abril' },
  { value: '05', label: '05 - Mayo' },
  { value: '06', label: '06 - Junio' },
  { value: '07', label: '07 - Julio' },
  { value: '08', label: '08 - Agosto' },
  { value: '09', label: '09 - Setiembre' },
  { value: '10', label: '10 - Octubre' },
  { value: '11', label: '11 - Noviembre' },
  { value: '12', label: '12 - Diciembre' },
];

export const PleExportModal = ({ isOpen, onClose }: PleExportModalProps) => {
  const { activeCompany } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PleExportFormData>({
    resolver: zodResolver(pleExportSchema),
    defaultValues: {
      book_type: '13.1',
      fiscal_year: new Date().getFullYear(),
      month: '00',
    },
  });

  const selectedBook = watch('book_type') || '13.1';
  const selectedYear = watch('fiscal_year') || new Date().getFullYear();
  const selectedMonth = watch('month') || '00';

  const companyRuc = activeCompany?.ruc || '20601012341';
  const bookSubCode = selectedBook === '12.1' ? '120100' : '130100';
  const officialFileName = `LE${companyRuc}${selectedYear}${selectedMonth}00${bookSubCode}001111.txt`;

  const onSubmit = async (data: PleExportFormData) => {
    setIsExporting(true);
    setServerError(null);
    setSuccessInfo(null);
    try {
      const { blob, fileName, recordsCount } = await inventoryApi.exportPleBook(data);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccessInfo(`Archivo oficial PLE descargado: ${fileName} (${recordsCount} asientos SUNAT).`);
    } catch (err: any) {
      setServerError(err.response?.data?.message || err.message || 'Error al exportar libro PLE.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcelAudit = async () => {
    try {
      setIsExporting(true);
      const is13_1 = selectedBook === '13.1';
      const cols = is13_1
        ? ['Periodo', 'CUO', 'Correlativo', 'Establecimiento', 'Catalogo', 'Tipo_Existencia', 'SKU', 'Cod_SUNAT', 'Fecha', 'Tipo_Doc', 'Serie', 'Numero', 'Tipo_Operacion', 'Descripcion', 'Unidad', 'Metodo', 'Entrada_Cant', 'Entrada_Costo_Unit', 'Entrada_Total', 'Salida_Cant', 'Salida_Costo_Unit', 'Salida_Total', 'Saldo_Cant', 'Saldo_Costo_Prom', 'Saldo_Total', 'Estado']
        : ['Periodo', 'CUO', 'Correlativo', 'Establecimiento', 'Catalogo', 'Tipo_Existencia', 'SKU', 'Cod_SUNAT', 'Fecha', 'Tipo_Doc', 'Serie', 'Numero', 'Tipo_Operacion', 'Descripcion', 'Unidad', 'Entrada_Cant', 'Salida_Cant', 'Saldo_Cant', 'Estado'];

      const movData = await inventoryApi.listMovements();
      const realMovements = movData.items || [];

      const rows = realMovements.map((m, idx) => {
        const isEntry = m.direction === 'ENTRADA';
        const inQty = isEntry ? m.quantity.toFixed(2) : '0.00';
        const inCost = isEntry ? m.unitCost.toFixed(4) : '0.0000';
        const inTotal = isEntry ? m.totalCost.toFixed(2) : '0.00';

        const outQty = !isEntry ? m.quantity.toFixed(2) : '0.00';
        const outCost = !isEntry ? m.unitCost.toFixed(4) : '0.0000';
        const outTotal = !isEntry ? m.totalCost.toFixed(2) : '0.00';

        const period = `${selectedYear}${selectedMonth}00`;
        const cuo = `CUO-${String(idx + 1).padStart(4, '0')}`;
        const correlative = `M${String(idx + 1).padStart(5, '0')}`;
        const wh = m.warehouseCode || '0000';
        const dateFormatted = new Date(m.movementDate).toLocaleDateString('es-PE');
        const docParts = (m.documentNumber || '').split('-');
        const docSerie = m.documentSerial || docParts[0] || '0001';
        const docNum = numeroDocumentoSinSerie(docSerie, m.documentNumber) || '00000001';

        if (is13_1) {
          return [
            period,
            cuo,
            correlative,
            wh,
            '9',
            '01',
            m.sku,
            '',
            dateFormatted,
            m.documentTypeCode || '00',
            docSerie,
            docNum,
            m.operationTypeCode,
            m.description || m.sku,
            'NIU',
            '2 - CPP',
            inQty,
            inCost,
            inTotal,
            outQty,
            outCost,
            outTotal,
            m.resultingStock.toFixed(2),
            m.unitCost.toFixed(4),
            (m.resultingStock * m.unitCost).toFixed(2),
            '1',
          ];
        } else {
          return [
            period,
            cuo,
            correlative,
            wh,
            '9',
            '01',
            m.sku,
            '',
            dateFormatted,
            m.documentTypeCode || '00',
            docSerie,
            docNum,
            m.operationTypeCode,
            m.description || m.sku,
            'NIU',
            inQty,
            outQty,
            m.resultingStock.toFixed(2),
            '1',
          ];
        }
      });

      const csvContent = '\uFEFF' + [cols.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Auditoria_Kardex_${selectedBook.replace('.', '_')}_${selectedYear}${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccessInfo(`Reporte de auditoría real generado con ${realMovements.length} movimientos de BD.`);
    } catch (err: any) {
      setServerError(err.message || 'Error al obtener movimientos de base de datos para la auditoría.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Exportación Oficial Libros PLE SUNAT
          </DialogTitle>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {successInfo && (
          <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription>{successInfo}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Formato de Libro Electrónico *
            </label>
            <select
              {...register('book_type')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
            >
              <option value="13.1">PLE 13.1 - Registro Permanente Valorizado (27 campos)</option>
              <option value="12.1">PLE 12.1 - Registro en Unidades Físicas (20 campos)</option>
            </select>
            {errors.book_type && <p className="text-xs text-destructive mt-1">{errors.book_type.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Ejercicio Fiscal *</label>
              <Input
                type="number"
                {...register('fiscal_year', { valueAsNumber: true })}
                className="mt-1 font-semibold"
              />
              {errors.fiscal_year && <p className="text-xs text-destructive mt-1">{errors.fiscal_year.message}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Período / Mes</label>
              <select
                {...register('month')}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1"
              >
                {MONTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ficha de Auditoría y Verificación Previa */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">RUC Contribuyente:</span>
              <span className="font-mono font-semibold">{companyRuc}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estructura SUNAT:</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {selectedBook === '13.1' ? '27 columnas (Kardex)' : '20 columnas (Físico)'}
              </Badge>
            </div>
            <div className="pt-1 border-t">
              <span className="text-muted-foreground block text-[11px] mb-1">Nombre Técnico Oficial (37 caract.):</span>
              <div className="bg-background/80 rounded px-2 py-1 font-mono text-[11px] text-foreground border break-all">
                {officialFileName}
              </div>
            </div>
          </div>

          <div className="rounded-md border p-3 bg-muted/40 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Base Normativa R.S. 286-2009 y 379-2013/SUNAT:</p>
            <p>
              El validador oficial del PLE exige archivos de texto plano (.txt) con delimitadores pipe (|). Utilice el
              archivo Excel/CSV para conciliar y auditar los saldos contables antes del envío a SUNAT.
            </p>
          </div>

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isExporting}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleExportExcelAudit}
              disabled={isExporting}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Excel de Auditoría
            </Button>
            <Button type="submit" disabled={isExporting} className="gap-2">
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generar TXT PLE
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
