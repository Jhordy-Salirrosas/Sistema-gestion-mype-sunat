/**
 * Libro Diario (PCGE).
 *
 * La pantalla trabaja contra el backend real: no guarda asientos en
 * `localStorage` ni inventa una trama PLE cuando la API falla. El período es
 * seleccionable y los asientos muestran su origen (factura, importación o
 * manual), para que contabilidad pueda auditar de dónde salió cada línea.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { cachedGet } from '@/lib/offlineCache';
import { DoubleEntryBalanceCard } from '../components/DoubleEntryBalanceCard';
import {
  Badge,
  Button,
  Card,
  Input,
  Page,
  PageHeader,
  PageText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatCurrency, formatDateToPeru } from '@/lib/formatters';
import {
  BookOpen,
  Download,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import ManualEntryModal from '../components/ManualEntryModal';
import { useAuthStore } from '@/stores/authStore';

interface AccountingLine {
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
}

interface Entry {
  id: string;
  numeroAsiento: string;
  fechaContable: string;
  glosa: string;
  totalDebe: number;
  totalHaber: number;
  estaCuadrado: boolean;
  sourceModule: string;
  sourceReferenceId?: string;
  lines: AccountingLine[];
}

interface LineaAsientoBackend {
  accountCode?: string;
  account_code?: string;
  accountName?: string;
  account_name?: string;
  debitAmount?: number | string;
  debit?: number | string;
  creditAmount?: number | string;
  credit?: number | string;
}

interface AsientoBackend {
  id?: string;
  numeroAsiento?: string;
  entryNumber?: number;
  entry_number?: number;
  entryDate?: string;
  entry_date?: string;
  fechaContable?: string;
  glosa?: string;
  concept?: string;
  totalDebit?: number | string;
  total_debit?: number | string;
  totalDebe?: number | string;
  totalCredit?: number | string;
  total_credit?: number | string;
  totalHaber?: number | string;
  sourceModule?: string;
  source_module?: string;
  sourceReferenceId?: string;
  source_reference_id?: string;
  lines?: LineaAsientoBackend[];
  accounting_lines?: LineaAsientoBackend[];
}

const periodoActual = (): string => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
};

const numeroVisible = (
  entryNumber: number | undefined,
  period: string,
  index: number,
): string => {
  const correlativo = String(entryNumber ?? index + 1).padStart(3, '0');
  return `001-${period.replace('-', '')}-${correlativo}`;
};

const mapearAsiento = (
  item: AsientoBackend,
  period: string,
  index: number,
): Entry => {
  const lines = (item.lines ?? item.accounting_lines ?? []).map((linea) => ({
    accountCode: linea.accountCode ?? linea.account_code ?? '',
    accountName: linea.accountName ?? linea.account_name ?? '',
    debitAmount: Number(linea.debitAmount ?? linea.debit ?? 0),
    creditAmount: Number(linea.creditAmount ?? linea.credit ?? 0),
  }));

  const totalDebe =
    lines.length > 0
      ? lines.reduce((acc, linea) => acc + linea.debitAmount, 0)
      : Number(item.totalDebit ?? item.total_debit ?? item.totalDebe ?? 0);
  const totalHaber =
    lines.length > 0
      ? lines.reduce((acc, linea) => acc + linea.creditAmount, 0)
      : Number(item.totalCredit ?? item.total_credit ?? item.totalHaber ?? 0);

  return {
    id: String(item.id ?? `${period}-${index}`),
    numeroAsiento: numeroVisible(
      item.entryNumber ?? item.entry_number,
      period,
      index,
    ),
    fechaContable:
      item.entryDate ??
      item.entry_date ??
      item.fechaContable ??
      new Date().toISOString().slice(0, 10),
    glosa: item.glosa ?? item.concept ?? 'Asiento contable',
    totalDebe,
    totalHaber,
    estaCuadrado: Math.abs(totalDebe - totalHaber) <= 0.01,
    sourceModule: item.sourceModule ?? item.source_module ?? 'MANUAL',
    sourceReferenceId: item.sourceReferenceId ?? item.source_reference_id,
    lines,
  };
};

const etiquetaOrigen = (source: string): string => {
  const etiquetas: Record<string, string> = {
    INVOICES: 'Facturación',
    CUSTOMS: 'Importaciones',
    MANUAL: 'Manual',
  };
  return etiquetas[source] ?? source;
};

export default function AccountingEntriesPage() {
  const { canCreateAccountingEntry, isAuditor } = useRolePermissions();
  const { activeCompany, user } = useAuthStore();
  const companyId = activeCompany?.tenantId ?? user?.companyId ?? '';
  const companyRuc = activeCompany?.ruc ?? user?.companyRuc ?? '';

  const [period, setPeriod] = useState(periodoActual);
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: asientosBackend,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['accounting-entries', period],
    queryFn: () =>
      cachedGet(`accounting-entries-page:${period}`, async () => {
        const { data } = await apiClient.get<AsientoBackend[]>(
          '/accounting/entries',
          { params: { period } },
        );
        return data;
      }),
    enabled: Boolean(companyId),
  });

  const entries = useMemo(
    () =>
      (Array.isArray(asientosBackend) ? asientosBackend : []).map(
        (item, index) => mapearAsiento(item, period, index),
      ),
    [asientosBackend, period],
  );

  const totalDebe = useMemo(
    () => entries.reduce((acc, entry) => acc + entry.totalDebe, 0),
    [entries],
  );
  const totalHaber = useMemo(
    () => entries.reduce((acc, entry) => acc + entry.totalHaber, 0),
    [entries],
  );

  const loadError = queryError
    ? 'No se pudieron cargar los asientos del período. Revisa la sesión y la conexión con el backend.'
    : null;

  const exportarPle = async () => {
    if (entries.length === 0) {
      setError('No hay asientos para exportar en el período seleccionado.');
      return;
    }

    setIsExporting(true);
    setError(null);
    try {
      const { data } = await apiClient.post<{
        fileName?: string;
        content?: string;
      }>(
        '/accounting/ple/export',
        {
          companyId,
          companyRuc,
          year: Number(period.slice(0, 4)),
          month: Number(period.slice(5, 7)),
          bookCode: '050100',
        },
        { timeout: 60_000 },
      );

      if (!data.fileName || !data.content) {
        throw new Error('El backend no devolvió una trama PLE válida');
      }

      const blob = new Blob([data.content], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError(
        'No se pudo generar el PLE del período. No se descargó ningún archivo simulado.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Libro Diario (PCGE)"
        description="Asientos del período, origen del movimiento y validación de partida doble"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            aria-hidden="true"
            className={isFetching ? 'animate-spin' : ''}
          />
          {isFetching ? 'Refrescando...' : 'Refrescar'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportarPle}
          disabled={isExporting || entries.length === 0}
        >
          <Download aria-hidden="true" />
          {isExporting ? 'Exportando...' : 'Exportar PLE (.txt)'}
        </Button>

        {canCreateAccountingEntry ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            <PlusCircle aria-hidden="true" />
            Nuevo Asiento
          </Button>
        ) : isAuditor ? (
          <Badge
            variant="outline"
            className="h-9 px-3 text-xs bg-muted/60 text-muted-foreground border-dashed"
          >
            Auditoría contable (solo lectura)
          </Badge>
        ) : null}
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-foreground"
              htmlFor="periodo-contable"
            >
              Período contable
            </label>
            <Input
              id="periodo-contable"
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="w-44"
            />
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            Se consultan y exportan solo los asientos de este período.
          </p>
        </div>
      </Card>

      {(error ?? loadError) && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error ?? loadError}
        </div>
      )}

      <DoubleEntryBalanceCard totalDebe={totalDebe} totalHaber={totalHaber} />

      <Card flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Asiento</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Glosa / Concepto</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead align="right">Total Debe</TableHead>
              <TableHead align="right">Total Haber</TableHead>
              <TableHead align="center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <PageText variant="muted">Cargando asientos...</PageText>
                </TableCell>
              </TableRow>
            ) : entries.length > 0 ? (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">
                    {entry.numeroAsiento}
                  </TableCell>
                  <TableCell>{formatDateToPeru(entry.fechaContable)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span>{entry.glosa}</span>
                      <div className="flex flex-wrap gap-1">
                        {entry.lines.slice(0, 3).map((linea, index) => (
                          <Badge
                            key={`${entry.id}-${index}`}
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {linea.accountCode}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {etiquetaOrigen(entry.sourceModule)}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(entry.totalDebe, 'PEN')}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(entry.totalHaber, 'PEN')}
                  </TableCell>
                  <TableCell align="center">
                    <Badge
                      variant={
                        entry.estaCuadrado ? 'secondary' : 'destructive'
                      }
                    >
                      {entry.estaCuadrado ? 'Cuadrado' : 'Descuadrado'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <BookOpen aria-hidden="true" />
                  <PageText variant="muted">
                    {loadError
                      ? 'No se pudo cargar el período. Usa Refrescar para reintentar.'
                      : `No hay asientos contables en ${period}. Las facturas aceptadas por SUNAT aparecerán aquí automáticamente.`}
                  </PageText>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ManualEntryModal
        open={isModalOpen}
        period={period}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => void refetch()}
      />
    </Page>
  );
}
