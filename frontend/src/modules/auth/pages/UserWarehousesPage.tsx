import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Page, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { useAuth } from '@/hooks/useAuth';
import { rolesApi } from '../services/rolesApi';
import { usePermissionsIdentity } from '../hooks/usePermissionsIdentity';
import { warehousesApi, type CreateUserInput } from '../services/warehousesApi';

export default function UserWarehousesPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const {user,scope}=usePermissionsIdentity();
  const roleCatalog=useQuery({queryKey:['roles',...scope],queryFn:rolesApi.list,enabled:Boolean(user)&&isAdmin});
  const roleConfig=useQuery({queryKey:['roles-config',...scope],queryFn:rolesApi.config,enabled:Boolean(user)&&isAdmin});
  const availableRoles=(roleCatalog.data??[]).filter(r=>r.isSystem||roleConfig.data?.customRolesEnabled);
  const emptyUser: CreateUserInput = { name: '', email: '', password: '', role: '' };
  const [nuevo, setNuevo] = useState<CreateUserInput>(emptyUser);
  const [createMessage, setCreateMessage] = useState('');
  const crear = useMutation({
    // La contraseña no se guarda en variables de la caché de mutaciones.
    mutationFn: () => warehousesApi.createUser(nuevo),
    onSuccess: async () => { setNuevo(emptyUser); setCreateMessage('Usuario creado.'); await queryClient.invalidateQueries({ queryKey: ['auth', 'users'] }); },
    onError: (e: unknown) => {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setCreateMessage(status === 409 ? 'El correo electrónico ya está registrado.' : status === 403 ? 'No tiene permiso para crear usuarios.' : extractApiErrorMessage(e, 'No se pudo crear el usuario.'));
    },
  });
  const almacenes = useQuery({ queryKey: ['auth', 'warehouses',...scope], queryFn: warehousesApi.list });
  const usuarios = useQuery({ queryKey: ['auth', 'users',...scope], queryFn: warehousesApi.listUsers });
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>({});
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [activos, setActivos] = useState<Record<string, boolean>>({});
  const [mensaje, setMensaje] = useState('');
  useEffect(() => {
    if (usuarios.data) {
      setSeleccion(Object.fromEntries(usuarios.data.map((u) => [u.id, u.warehouseCodes])));
      setRoles(Object.fromEntries(usuarios.data.map((u) => [u.id, u.role])));
      setActivos(Object.fromEntries(usuarios.data.map((u) => [u.id, u.isActive])));
    }
  }, [usuarios.data]);
  const guardar = useMutation({
    mutationFn: async (userId: string) => {
      await warehousesApi.updateUser(userId, { role: roles[userId], isActive: activos[userId] });
      const usuario = (usuarios.data ?? []).find((u) => u.id === userId);
      if (usuario?.role !== 'ADMIN' && roles[userId] !== 'ADMIN') await warehousesApi.setUserWarehouses(userId, seleccion[userId] ?? []);
    },
    onSuccess: async () => { setMensaje('Accesos actualizados.'); await queryClient.invalidateQueries({ queryKey: ['auth', 'users'] }); },
    onError: (e: unknown) => setMensaje(extractApiErrorMessage(e, 'No se pudieron guardar los accesos.')),
  });
  const alternar = (userId: string, code: string) => {
    const actual = seleccion[userId] ?? [];
    setSeleccion({ ...seleccion, [userId]: actual.includes(code) ? actual.filter((c) => c !== code) : [...actual, code] });
  };
  return (
    <Page>
      <PageHeader title="Usuarios y almacenes" description="Define qué almacenes puede usar cada usuario. El administrador conserva acceso a todos." />
      {mensaje ? <p role="status" className="mb-3 text-xs text-muted-foreground">{mensaje}</p> : null}
      {isAdmin ? <Card className="mb-4 p-4">
        <h2 className="mb-3 text-sm font-semibold">Crear usuario</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); if (isAdmin && roleCatalog.isSuccess && roleConfig.isSuccess && availableRoles.some(r=>r.code===nuevo.role) && !crear.isPending) { setCreateMessage(''); crear.mutate(); } }}>
          <label className="text-xs">Nombre<input className="mt-1 block w-full rounded border bg-background p-2" name="name" autoComplete="name" required minLength={3} maxLength={150} value={nuevo.name} onChange={event => setNuevo({ ...nuevo, name: event.target.value })} /></label>
          <label className="text-xs">Correo electrónico<input className="mt-1 block w-full rounded border bg-background p-2" type="email" name="email" autoComplete="email" required value={nuevo.email} onChange={event => setNuevo({ ...nuevo, email: event.target.value })} /></label>
          <label className="text-xs">Contraseña<input className="mt-1 block w-full rounded border bg-background p-2" type="password" name="password" autoComplete="new-password" required minLength={8} value={nuevo.password} onChange={event => setNuevo({ ...nuevo, password: event.target.value })} /></label>
          <label className="text-xs">Rol del nuevo usuario<select className="mt-1 block w-full rounded border bg-background p-2" value={nuevo.role} onChange={event => setNuevo({ ...nuevo, role: event.target.value as CreateUserInput['role'] })}><option value="">Seleccione un rol</option>{availableRoles.map(role => <option key={role.code} value={role.code}>{role.name} ({role.code})</option>)}</select></label>
          <Button type="submit" disabled={crear.isPending||!roleCatalog.isSuccess||!roleConfig.isSuccess||!nuevo.role}>{crear.isPending ? 'Creando usuario…' : 'Crear usuario'}</Button>
        </form>
        {createMessage ? <p className="mt-3 text-xs" role={crear.isError ? 'alert' : 'status'}>{createMessage}</p> : null}
      </Card> : null}
      {roleConfig.isSuccess&&!roleConfig.data.customRolesEnabled?<p className="mb-3 text-xs text-muted-foreground">La asignación de roles propios no está habilitada.</p>:null}
      {roleCatalog.isError||roleConfig.isError?<p role="alert">No se pudieron consultar los roles de la empresa.</p>:null}
      {usuarios.isError ? <p role="alert">No se pudieron consultar los usuarios.</p> : null}
      <Card flush>
        <Table>
          <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Rol / estado</TableHead><TableHead>Almacenes permitidos</TableHead><TableHead align="right">Acción</TableHead></TableRow></TableHeader>
          <TableBody>
            {usuarios.isLoading ? <TableRow><TableCell colSpan={4}>Cargando usuarios…</TableCell></TableRow> : null}
            {(usuarios.data ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell><p className="text-xs font-medium">{u.fullName}</p><p className="text-[11px] text-muted-foreground">{u.email}</p></TableCell>
                <TableCell><select aria-label={`Rol ${u.email}`} className="h-8 rounded-md border bg-background px-2 text-xs" value={roles[u.id] ?? u.role} onChange={(e) => setRoles({ ...roles, [u.id]: e.target.value })}>{availableRoles.map(role=><option key={role.code} value={role.code}>{role.name} ({role.code})</option>)}</select><label className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><input type="checkbox" checked={activos[u.id] ?? u.isActive} onChange={(e) => setActivos({ ...activos, [u.id]: e.target.checked })} />Activo</label></TableCell>
                <TableCell>
                  {u.role === 'ADMIN' ? <span className="text-xs text-muted-foreground">Todos los almacenes</span> : (
                    <div className="flex flex-wrap gap-2">
                      {(almacenes.data ?? []).map((a) => (
                        <label key={a.warehouse_code} className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={(seleccion[u.id] ?? []).includes(a.warehouse_code)} onChange={() => alternar(u.id, a.warehouse_code)} />
                          {a.warehouse_code} · {a.description}
                        </label>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell align="right"><Button size="sm" variant="outline" disabled={guardar.isPending||!roleCatalog.isSuccess||!roleConfig.isSuccess} onClick={() => guardar.mutate(u.id)}>Guardar</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Page>
  );
}
