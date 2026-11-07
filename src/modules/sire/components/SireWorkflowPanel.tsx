import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  Input, Tabs, TabsContent, TabsList, TabsTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { Bell, FileDown, FileUp, LoaderCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { validateRucModulo11 } from '@/modules/auth/validators/rucValidator';
import { useSirePolling } from '../hooks/useSirePolling';
import { sireApi } from '../services/sireApi';
import type { SireBookType, SireWorkflowRecord, SireWorkflowRequest, SireWorkflowResponse } from '../types/sire.types';

type WorkflowTab = 'proposal' | 'excluded' | 'preliminary' | 'generated';

const stateLabel: Record<SireWorkflowResponse['state'], string> = {
  PROPUESTA: 'Propuesta lista',
  PROCESANDO_REEMPLAZO: 'Procesando reemplazo',
  PROCESANDO_PRELIMINAR: 'Procesando preliminar',
  CON_PRELIMINAR: 'Preliminar en edición',
  PROCESANDO_GENERACION: 'Procesando generación',
  GENERADO: 'Generado',
  ERROR: 'Error',
};

const stateClass: Record<SireWorkflowResponse['state'], string> = {
  PROPUESTA: 'border-blue-300 bg-blue-50 text-blue-800',
  PROCESANDO_REEMPLAZO: 'border-amber-300 bg-amber-50 text-amber-800',
  PROCESANDO_PRELIMINAR: 'border-amber-300 bg-amber-50 text-amber-800',
  CON_PRELIMINAR: 'border-amber-300 bg-amber-50 text-amber-800',
  PROCESANDO_GENERACION: 'border-amber-300 bg-amber-50 text-amber-800',
  GENERADO: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  ERROR: 'border-red-300 bg-red-50 text-red-800',
};

const EmptyTable = ({ message }: { message: string }) => (
  <TableRow><TableCell colSpan={9} className="h-20 text-center text-muted-foreground">{message}</TableCell></TableRow>
);

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const isAllowedTextFile = (file: File) => /\.txt$/i.test(file.name) && file.size > 0 && file.size <= MAX_FILE_SIZE;
const isAllowedReportFile = (file: File) => /\.(csv|xlsx)$/i.test(file.name) && file.size > 0 && file.size <= MAX_FILE_SIZE;
const isPeriodValid = (period: string) => /^\d{4}(0[1-9]|1[0-2])$/.test(period);
const isExcluded = (record: SireWorkflowRecord) => record.excluded === true || record.status === 'EXCLUIDO';
const formatSize = (file: File) => `${(file.size / 1024).toFixed(1)} KB`;
const isSameBook = (responseBook: SireWorkflowResponse['bookType'], requestBook: SireBookType) =>
  responseBook === requestBook ||
  (responseBook === 'RVIE' && requestBook === 'RVIE_VENTAS') ||
  (responseBook === 'RCE' && requestBook === 'RCE_COMPRAS');
const isWorkflowResponse = (value: unknown): value is SireWorkflowResponse =>
  typeof value === 'object' &&
  value !== null &&
  'period' in value &&
  typeof value.period === 'string' &&
  'state' in value &&
  ['PROPUESTA', 'PROCESANDO_REEMPLAZO', 'PROCESANDO_PRELIMINAR', 'CON_PRELIMINAR', 'PROCESANDO_GENERACION', 'GENERADO', 'ERROR'].includes(String(value.state)) &&
  'ticket' in value &&
  (typeof value.ticket === 'string' || value.ticket === null);

export const SireWorkflowPanel = ({ period, bookType, onPeriodChange, onBookTypeChange }: {
  period: string;
  bookType: SireBookType;
  onPeriodChange: (value: string) => void;
  onBookTypeChange: (value: SireBookType) => void;
}) => {
  const [tab, setTab] = useState<WorkflowTab>('proposal');
  const [workflow, setWorkflow] = useState<SireWorkflowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const operationLock = useRef(false);
  const activeRuc = useAuthStore((state) => state.activeCompany?.ruc ?? null);
  const request = useMemo<SireWorkflowRequest>(() => ({ period, bookType }), [bookType, period]);
  const validRequest = isPeriodValid(period);
  const validActiveRuc = activeRuc !== null && validateRucModulo11(activeRuc);

  const workflowForRequest = workflow?.period === period && isSameBook(workflow.bookType, bookType) ? workflow : null;

  const reloadRecords = useCallback(async (response: SireWorkflowResponse) => {
    setWorkflow(response);
    if (response.status !== 'TERMINADO' && response.status !== 'ERROR') {
      return;
    }

    const refreshed = response.state === 'GENERADO'
      ? await sireApi.getGenerated(request)
      : response.state === 'CON_PRELIMINAR'
        ? await sireApi.getPreliminary(request)
        : tab === 'preliminary'
          ? await sireApi.getPreliminary(request)
          : await sireApi.getProposal(request);
    setWorkflow(response.status === 'ERROR' || response.state === 'ERROR'
      ? { ...refreshed, state: 'ERROR', status: 'ERROR', ticket: response.ticket, error: response.error }
      : refreshed);
    if (response.status === 'ERROR' || response.state === 'ERROR') {
      setError(response.error?.message ?? 'La operación terminó con error.');
      return;
    }
    setError(null);
    setNotice('La operación terminó correctamente y se actualizaron los registros.');
  }, [request, tab]);

  const polling = useSirePolling(
    workflowForRequest?.ticket ? request : null,
    workflowForRequest,
    (response) => { void reloadRecords(response).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Terminó el ticket, pero no se pudieron actualizar los registros.')); },
  );
  const current = polling.current ?? workflowForRequest;
  const generated = current?.state === 'GENERADO';
  const records = current?.records ?? [];
  const proposalRecords = records.filter((record) => !isExcluded(record));
  const excludedRecords = records.filter(isExcluded);

  const run = async (operation: () => Promise<SireWorkflowResponse>, success?: string, refresh = false) => {
    if (operationLock.current || !validRequest || !validActiveRuc) {
      if (!validRequest) setPeriodError('Ingresa un periodo válido con formato YYYYMM.');
      if (!validActiveRuc) {
        setError(activeRuc
          ? 'El RUC asociado a la sesión no es válido. Corrige los datos de la empresa.'
          : 'No se encontró un RUC de empresa en la sesión. Inicia sesión nuevamente o selecciona una empresa.');
      }
      return;
    }
    operationLock.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await operation();
      setWorkflow(response);
      if (response.state === 'ERROR' || response.status === 'ERROR') {
        setError(response.error?.message ?? 'El backend informó que la operación terminó con error.');
      } else if (response.ticket && response.status !== 'TERMINADO') {
        setNotice(null);
      } else if (success) {
        if (refresh) {
          const refreshed = response.state === 'GENERADO'
            ? await sireApi.getGenerated(request)
            : response.state === 'CON_PRELIMINAR' || tab === 'preliminary'
              ? await sireApi.getPreliminary(request)
              : await sireApi.getProposal(request);
          setWorkflow(refreshed);
        }
        setNotice(success);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación SIRE.');
    } finally {
      operationLock.current = false;
      setLoading(false);
    }
  };

  const consultProposal = () => void run(() => sireApi.getProposal(request));
  const changePeriod = (value: string) => {
    onPeriodChange(value);
    setWorkflow(null);
    setError(null);
    setNotice(null);
    setPeriodError(null);
  };
  const changeBookType = (value: SireBookType) => {
    onBookTypeChange(value);
    setWorkflow(null);
    setError(null);
    setNotice(null);
  };
  const actionRequest = (record: SireWorkflowRecord) => ({
    ...request,
    proposalId: record.proposalId,
    reason: 'Acción solicitada por el usuario',
  });
  const exclude = (record: SireWorkflowRecord) => void run(() => sireApi.exclude(actionRequest(record)), 'Registro excluido.', true);
  const restore = (record: SireWorkflowRecord) => void run(() => sireApi.restore(actionRequest(record)), 'Registro restaurado a la propuesta.', true);
  const remove = (record: SireWorkflowRecord) => void run(() => sireApi.removePreliminaryRecord(actionRequest(record)), 'Registro eliminado del preliminar.', true);

  const importTxt = async () => {
    if (operationLock.current) return;
    if (!validActiveRuc) {
      setError(activeRuc
        ? 'El RUC asociado a la sesión no es válido. Corrige los datos de la empresa.'
        : 'No se encontró un RUC de empresa en la sesión. Inicia sesión nuevamente o selecciona una empresa.');
      return;
    }
    if (!proposalFile || !isAllowedTextFile(proposalFile)) {
      setError('Selecciona un archivo TXT no vacío de máximo 5 MiB.');
      return;
    }
    operationLock.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await sireApi.importProposal({ period, bookType }, proposalFile);
      const proposal = await sireApi.getProposal(request);
      setWorkflow(proposal);
      setNotice(`Importación finalizada: ${result.imported} registros importados y ${result.rejected} rechazados.`);
      setProposalFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo importar el archivo TXT.');
    } finally {
      operationLock.current = false;
      setLoading(false);
    }
  };

  const uploadReport = () => {
    if (!reportFile || !isAllowedReportFile(reportFile)) {
      setError('Selecciona un archivo CSV o XLSX no vacío de máximo 5 MiB.');
      return;
    }
    void run(() => sireApi.uploadReport({ ...request, file: reportFile }), 'Reporte cargado correctamente.', true);
  };

  const exportRecords = async () => {
    if (operationLock.current || !validRequest || !validActiveRuc) return;
    operationLock.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await sireApi.export(request);
      if (result.kind === 'file') {
        const url = URL.createObjectURL(result.blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = result.filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        setNotice('El archivo de exportación se descargó correctamente.');
      } else if (isWorkflowResponse(result.body)) {
        setWorkflow(result.body);
        if (result.body.status === 'PENDIENTE') return;
        if (result.body.status === 'ERROR' || result.body.state === 'ERROR') {
          setError(result.body.error?.message ?? 'El backend informó un error al exportar.');
          return;
        }
        if (result.body.status === 'TERMINADO') setNotice('La exportación terminó correctamente.');
        else setError('El servidor no informó el resultado de la exportación.');
      } else if (
        typeof result.body === 'object' &&
        result.body !== null &&
        'message' in result.body &&
        typeof result.body.message === 'string'
      ) {
        setNotice(result.body.message);
      } else {
        setError('El servidor devolvió una respuesta de exportación no reconocida.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo exportar el registro SIRE.');
    } finally {
      operationLock.current = false;
      setLoading(false);
    }
  };

  const replaceProposal = (file: File) => {
    if (!isAllowedTextFile(file)) {
      setError('Selecciona un archivo TXT no vacío de máximo 5 MiB.');
      return;
    }
    if (window.confirm(`¿Reemplazar la propuesta del periodo ${period} con ${file.name}?`)) {
      void run(() => sireApi.replaceProposal({ ...request, file }), 'Propuesta reemplazada correctamente.', true);
    }
  };

  const confirmAction = (message: string, operation: () => void) => {
    if (!operationLock.current && window.confirm(message)) operation();
  };

  const changeTab = (value: string) => {
    if (value !== 'proposal' && value !== 'excluded' && value !== 'preliminary' && value !== 'generated') return;
    const nextTab = value as WorkflowTab;
    setTab(nextTab);
    if (nextTab === 'preliminary') void run(() => sireApi.getPreliminary(request));
    if (nextTab === 'generated') void run(() => sireApi.getGenerated(request));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>Flujo de propuesta SIRE</CardTitle><p className="mt-1 text-sm text-muted-foreground">Consulta y administra la propuesta, el preliminar y el registro generado.</p></div>
          <Badge variant="outline" aria-label="Estado del flujo" className={current ? stateClass[current.state] : ''}>{current ? stateLabel[current.state] : 'Borrador'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">Periodo (YYYYMM)
            <Input aria-label="Periodo de la propuesta" inputMode="numeric" maxLength={6} value={period} disabled={loading} aria-invalid={Boolean(periodError)} onChange={(event) => changePeriod(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">Tipo de libro
            <select aria-label="Tipo de libro de la propuesta" className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" value={bookType} disabled={loading} onChange={(event) => changeBookType(event.target.value as SireBookType)}>
              <option value="RVIE_VENTAS">RVIE · Ventas</option><option value="RCE_COMPRAS">RCE · Compras</option>
            </select>
          </label>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm" aria-label="RUC asociado a la sesión">
          <span className="font-medium">RUC de la empresa autenticada: </span>
          {activeRuc ?? 'No disponible'}
          <p className="mt-1 text-xs text-muted-foreground">
            La propuesta se consulta para la empresa asociada a tu sesión; el RUC no se envía en el payload.
          </p>
        </div>
        {activeRuc && !validActiveRuc && <p role="alert" className="text-sm text-destructive">El RUC asociado a la sesión no supera la validación del dígito verificador Módulo 11. Verifica los datos de la empresa antes de operar.</p>}
        {!validRequest && <p role="alert" className="text-sm text-destructive">Ingresa un periodo válido con formato YYYYMM.</p>}
        {periodError && <p role="alert" className="text-sm text-destructive">{periodError}</p>}
        {error && <Alert variant="destructive"><AlertTitle>No se pudo completar la operación SIRE</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {polling.error && <Alert variant="destructive"><AlertTitle>No se pudo consultar el ticket</AlertTitle><AlertDescription>{polling.error}</AlertDescription></Alert>}
        {notice && <Alert variant="success" role="status"><AlertTitle>Operación completada</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
        {current?.error && <Alert variant="destructive"><AlertTitle>{current.error.code}</AlertTitle><AlertDescription>{current.error.message} {current.error.details}</AlertDescription></Alert>}
        {loading && <p role="status" className="text-sm text-muted-foreground">Procesando solicitud con el backend…</p>}

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start"><TabsTrigger value="proposal">Propuesta</TabsTrigger><TabsTrigger value="excluded">Excluidos</TabsTrigger><TabsTrigger value="preliminary">Preliminar</TabsTrigger><TabsTrigger value="generated">Generado</TabsTrigger></TabsList>
          <TabsContent value="proposal" forceMount className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Comprobantes propuestos</h3><p className="text-sm text-muted-foreground">Periodo {period} · {bookType}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={loading || generated || !validRequest || !validActiveRuc} onClick={consultProposal}>{loading && <LoaderCircle className="animate-spin" />}Consultar propuesta</Button><Button type="button" variant="outline" disabled={loading || generated || !proposalFile} onClick={() => void importTxt()}>{loading && <LoaderCircle className="animate-spin" />}Importar TXT</Button><Button type="button" disabled={loading || generated || !proposalRecords.length} onClick={() => confirmAction('¿Aceptar la propuesta completa?', () => void run(() => sireApi.acceptProposal({ ...request, confirmed: true }), 'Propuesta aceptada.', true))}>Aceptar Propuesta Completa</Button></div></div>
            <FileSelection label="Archivo TXT de importación" file={proposalFile} accept=".txt,text/plain" disabled={loading || generated} onChange={setProposalFile} onCancel={() => setProposalFile(null)} />
            <FileSelection label="Reporte local CSV/XLSX" file={reportFile} accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={loading || generated} onChange={setReportFile} onCancel={() => setReportFile(null)} action={<Button type="button" variant="outline" size="sm" disabled={loading || generated || !reportFile} onClick={uploadReport}>Cargar reporte</Button>} />
            <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>RUC emisor</TableHead><TableHead>Comprobante</TableHead><TableHead>Fecha</TableHead><TableHead>Base</TableHead><TableHead>IGV</TableHead><TableHead>Total</TableHead><TableHead>Origen</TableHead><TableHead>Estado</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader><TableBody>{proposalRecords.length ? proposalRecords.map((record) => <WorkflowRow key={record.proposalId} record={record} actionLabel="Excluir" disabled={loading || generated} onAction={() => confirmAction('¿Excluir este registro?', () => exclude(record))} />) : <EmptyTable message={workflow ? 'No hay comprobantes en la propuesta.' : 'Consulta la propuesta para cargar comprobantes.'} />}</TableBody></Table></div>
          </TabsContent>
          <TabsContent value="excluded" forceMount className="mt-4 space-y-3"><p className="text-sm text-muted-foreground">Registros excluidos de la propuesta.</p><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>RUC emisor</TableHead><TableHead>Comprobante</TableHead><TableHead>Fecha</TableHead><TableHead>Base</TableHead><TableHead>IGV</TableHead><TableHead>Total</TableHead><TableHead>Origen</TableHead><TableHead>Estado</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader><TableBody>{excludedRecords.length ? excludedRecords.map((record) => <WorkflowRow key={record.proposalId} record={record} actionLabel="Restaurar a Propuesta" disabled={loading || generated} onAction={() => confirmAction('¿Restaurar este registro a la propuesta?', () => restore(record))} />) : <EmptyTable message="No hay comprobantes excluidos para este periodo." />}</TableBody></Table></div></TabsContent>
          <TabsContent value="preliminary" forceMount className="mt-4 space-y-3"><div className="flex flex-wrap justify-end gap-2"><label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm font-medium has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"><FileUp />Reemplazar propuesta TXT<Input className="sr-only" type="file" accept=".txt,text/plain" disabled={loading || generated} onChange={(event) => { const file = event.target.files?.[0]; if (file) replaceProposal(file); event.currentTarget.value = ''; }} /></label><Button type="button" disabled={loading || generated || !records.length} onClick={() => void run(() => sireApi.registerPreliminary({ ...request, records }), 'Preliminar registrado.', true)}>Registrar Preliminar</Button><Button type="button" disabled={loading || generated || !records.length} onClick={() => void run(() => sireApi.generate(request), 'Generación solicitada.', true)}>Generar registro</Button></div><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>RUC emisor</TableHead><TableHead>Comprobante</TableHead><TableHead>Fecha</TableHead><TableHead>Base</TableHead><TableHead>IGV</TableHead><TableHead>Total</TableHead><TableHead>Origen</TableHead><TableHead>Estado</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader><TableBody>{records.length ? records.map((record) => <WorkflowRow key={record.proposalId} record={record} actionLabel="Eliminar" disabled={loading || generated || record.origin !== 'USUARIO'} onAction={() => confirmAction('¿Eliminar este preliminar?', () => remove(record))} />) : <EmptyTable message="No hay registros en el preliminar para este periodo." />}</TableBody></Table></div></TabsContent>
          <TabsContent value="generated" forceMount className="mt-4 space-y-3"><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={loading || !validRequest || !records.length} onClick={() => void exportRecords()}><FileDown />Exportar</Button></div><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>RUC emisor</TableHead><TableHead>Comprobante</TableHead><TableHead>Fecha</TableHead><TableHead>Base</TableHead><TableHead>IGV</TableHead><TableHead>Total</TableHead><TableHead>Origen</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{records.length ? records.map((record) => <WorkflowRow key={record.proposalId} record={record} />) : <EmptyTable message="No hay registros generados para este periodo." />}</TableBody></Table></div></TabsContent>
        </Tabs>
        <section className="rounded-xl border bg-muted/30 p-4" aria-label="Monitor de tickets"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Bell className="size-4" /><h3 className="font-semibold">Monitor de tickets</h3></div><Button type="button" variant="outline" size="sm" disabled={!current?.ticket || loading || !validRequest} onClick={() => void run(() => sireApi.pollTicket(request))}><RefreshCw />Consultar ticket</Button></div><p className="mt-2 text-sm text-muted-foreground">{current?.ticket ? `Ticket ${current.ticket}: ${current.status ?? 'PENDIENTE'}` : 'No hay tickets pendientes.'}</p>{current?.status === 'PENDIENTE' && <p role="status" className="mt-1 text-xs text-muted-foreground">Esperando respuesta del backend…</p>}</section>
      </CardContent>
    </Card>
  );
};

const FileSelection = ({ label, file, accept, disabled, onChange, onCancel, action }: {
  label: string;
  file: File | null;
  accept: string;
  disabled: boolean;
  onChange: (file: File | null) => void;
  onCancel: () => void;
  action?: ReactNode;
}) => (
  <div className="rounded-lg border border-dashed p-3 text-sm">
    <label className="font-medium">{label}<input key={file?.name ?? 'no-file'} className="mt-2 block w-full text-sm" type="file" accept={accept} disabled={disabled} onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></label>
    {file && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{file.name} · {formatSize(file)}</span><Button type="button" variant="link" size="sm" className="px-1" onClick={onCancel}>Cancelar</Button>{action}</div>}
  </div>
);

const WorkflowRow = ({ record, actionLabel, disabled, onAction }: {
  record: SireWorkflowRecord;
  actionLabel?: string;
  disabled?: boolean;
  onAction?: () => void;
}) => (
  <TableRow>
    <TableCell>{record.emitterRuc}</TableCell>
    <TableCell>{record.documentType} {record.series}-{record.correlative}</TableCell>
    <TableCell>{record.issueDate}</TableCell>
    <TableCell>{record.taxableBase.toFixed(2)}</TableCell>
    <TableCell>{record.igvAmount.toFixed(2)}</TableCell>
    <TableCell>{record.totalAmount.toFixed(2)}</TableCell>
    <TableCell>{record.origin}</TableCell>
    <TableCell>{isExcluded(record) ? 'Excluido' : record.status ?? 'Activo'}</TableCell>
    {actionLabel && onAction && <TableCell><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onAction}>{actionLabel}</Button></TableCell>}
  </TableRow>
);
