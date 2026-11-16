import { useEffect, useState } from 'react';
import { ACTIONS_PERMISOS, actionPermissionsApi, type ActionPermission, type ActionCode } from '../services/actionPermissionsApi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Page, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { MODULES_PERMISOS, ROLES_PERMISOS, modulePermissionsApi, type ModulePermission } from '../services/modulePermissionsApi';

export default function RolePermissionsPage() {
  const queryClient = useQueryClient();
  const permisos = useQuery({ queryKey: ['module-permissions'], queryFn: modulePermissionsApi.list });
  const acciones = useQuery({ queryKey: ['action-permissions'], queryFn: actionPermissionsApi.list });
  const [actionRows, setActionRows] = useState<ActionPermission[]>([]);
  const [actionMessage, setActionMessage] = useState('');
  useEffect(() => { if (acciones.data) setActionRows(acciones.data); }, [acciones.data]);
  const guardarAcciones = useMutation({
    // ADMIN se consulta, pero nunca se envía desde este editor para impedir el autobloqueo.
    mutationFn: () => actionPermissionsApi.save(actionRows.filter(row => row.role !== 'ADMIN')),
    onSuccess: async data => { setActionRows(data); setActionMessage('Acciones guardadas.'); await queryClient.invalidateQueries({ queryKey: ['action-permissions-me'] }); },
    onError: (e: unknown) => setActionMessage(extractApiErrorMessage(e, 'No se pudieron guardar las acciones.')),
  });
  const cambiarAccion = (role: string, actionCode: ActionCode) => {
    if (role === 'ADMIN') return;
    setActionRows(prev => prev.map(row => row.role === role && row.actionCode === actionCode ? { ...row, allowed: !row.allowed } : row));
  };
  const [rows, setRows] = useState<ModulePermission[]>([]);
  const [mensaje, setMensaje] = useState('');
  useEffect(() => { if (permisos.data) setRows(permisos.data); }, [permisos.data]);
  const guardar = useMutation({
    mutationFn: () => modulePermissionsApi.save(rows),
    onSuccess: async (data) => { setRows(data); setMensaje('Permisos guardados.'); await queryClient.invalidateQueries({ queryKey: ['module-permissions-me'] }); },
    onError: (e: unknown) => setMensaje(extractApiErrorMessage(e, 'No se pudieron guardar los permisos.')),
  });
  const cambiar = (role: string, moduleCode: string, field: 'canView' | 'canWrite') => {
    if (role === 'ADMIN') return;
    setRows((prev) => prev.map((r) => r.role === role && r.moduleCode === moduleCode ? { ...r, [field]: !r[field], ...(field === 'canView' && r.canView ? { canWrite: false } : {}), ...(field === 'canWrite' && !r.canView ? { canView: true } : {}) } : r));
  };
  return (
    <Page>
      <PageHeader title="Permisos por módulo" description="Define visibilidad y escritura por rol. La fila ADMIN es de solo lectura.">
        <Button size="sm" onClick={() => guardar.mutate()} disabled={guardar.isPending || rows.length === 0}>{guardar.isPending ? 'Guardando…' : 'Guardar permisos'}</Button>
      </PageHeader>
      {mensaje ? <p role="status" className="mb-3 text-xs text-muted-foreground">{mensaje}</p> : null}
      <Card flush className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Rol</TableHead>{MODULES_PERMISOS.map(([code, name]) => <TableHead key={code}><span title={name}>{code}</span></TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {ROLES_PERMISOS.map((role) => (
              <TableRow key={role}>
                <TableCell className="text-xs font-medium">{role}</TableCell>
                {MODULES_PERMISOS.map(([code]) => {
                  const row = rows.find((r) => r.role === role && r.moduleCode === code);
                  return <TableCell key={code}><div className="space-y-1 text-[10px]"><label className="flex items-center gap-1"><input type="checkbox" aria-label={`${role} ${code} ver`} checked={row?.canView ?? false} disabled={role === 'ADMIN'} onChange={() => cambiar(role, code, 'canView')} />Ver</label><label className="flex items-center gap-1"><input type="checkbox" aria-label={`${role} ${code} escribir`} checked={row?.canWrite ?? false} disabled={role === 'ADMIN'} onChange={() => cambiar(role, code, 'canWrite')} />Editar</label></div></TableCell>;
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-[11px] text-muted-foreground">M1 Facturación · M2 Importaciones · M3 SIRE · M4 Contabilidad · M5 Resiliencia · M6 Inventario · M7 Ventas · M8 Compras · M9 Seguridad · M10 UX</p>
      <section aria-labelledby="acciones-title" className="mt-6 space-y-3">
        <h2 id="acciones-title" className="text-sm font-semibold">Acciones</h2>
        <p className="text-xs text-muted-foreground">Permisos específicos de facturación. La fila ADMIN es de solo lectura.</p>
        {acciones.isLoading ? <p role="status">Cargando acciones…</p> : null}
        {acciones.isError ? <p role="alert">No se pudieron consultar las acciones.</p> : null}
        {actionMessage ? <p role={guardarAcciones.isError ? 'alert' : 'status'}>{actionMessage}</p> : null}
        <Card flush className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Rol</TableHead>{ACTIONS_PERMISOS.map(([code, label]) => <TableHead key={code}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{ROLES_PERMISOS.map(role => <TableRow key={role}>
            <TableCell className="text-xs font-medium">{role}</TableCell>
            {ACTIONS_PERMISOS.map(([code]) => {
              const row = actionRows.find(r => r.role === role && r.actionCode === code);
              return <TableCell key={code}><input type="checkbox" aria-label={`${role} ${code}`} checked={row?.allowed ?? false} disabled={role === 'ADMIN' || !row || acciones.isError || guardarAcciones.isPending} onChange={() => cambiarAccion(role, code)} /></TableCell>;
            })}
          </TableRow>)}</TableBody>
        </Table></Card>
        <Button size="sm" disabled={!acciones.isSuccess || actionRows.length === 0 || guardarAcciones.isPending} onClick={() => guardarAcciones.mutate()}>{guardarAcciones.isPending ? 'Guardando acciones…' : 'Guardar acciones'}</Button>
      </section>
    </Page>
  );
}
