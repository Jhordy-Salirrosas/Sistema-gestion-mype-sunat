import { useEffect,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Button,Card,Page,PageHeader,Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { MODULES_PERMISOS,modulePermissionsApi,type ModulePermission } from '../services/modulePermissionsApi';
import { actionPermissionsApi,type ActionPermission } from '../services/actionPermissionsApi';
import { rolesApi,type MenuPermission } from '../services/rolesApi';
import { usePermissionsIdentity } from '../hooks/usePermissionsIdentity';
import { RoleMaintainer } from '../components/RoleMaintainer';

export default function RolePermissionsPage(){
 const q=useQueryClient();const {user,scope}=usePermissionsIdentity();
 const roles=useQuery({queryKey:['roles',...scope],queryFn:rolesApi.list,enabled:Boolean(user)});
 const catalog=useQuery({queryKey:['permission-catalog',...scope],queryFn:rolesApi.catalog,enabled:Boolean(user)});
 const config=useQuery({queryKey:['roles-config',...scope],queryFn:rolesApi.config,enabled:Boolean(user)});
 const modules=useQuery({queryKey:['module-permissions',...scope],queryFn:modulePermissionsApi.list,enabled:Boolean(user)});
 const actions=useQuery({queryKey:['action-permissions',...scope],queryFn:actionPermissionsApi.list,enabled:Boolean(user)});
 const menus=useQuery({queryKey:['menu-permissions',...scope],queryFn:rolesApi.menus,enabled:Boolean(user)});
 const canMutateRole=(code:string)=>code!=='ADMIN'&&Boolean(roles.data?.some(r=>r.code===code&&(r.isSystem||config.data?.customRolesEnabled)));
 const [moduleRows,setModuleRows]=useState<ModulePermission[]>([]);const [actionRows,setActionRows]=useState<ActionPermission[]>([]);const [menuRows,setMenuRows]=useState<MenuPermission[]>([]);const [message,setMessage]=useState('');const [menuRole,setMenuRole]=useState('');
 useEffect(()=>{if(modules.data)setModuleRows(modules.data);},[modules.data]);useEffect(()=>{if(actions.data)setActionRows(actions.data);},[actions.data]);useEffect(()=>{if(menus.data)setMenuRows(menus.data);},[menus.data]);
 const invalidate=async()=>{for(const key of ['permissions-me','module-permissions-me','action-permissions-me'])await q.invalidateQueries({queryKey:[key]});};
 const mutationOptions={onSuccess:async()=>{setMessage('Permisos guardados.');await invalidate();},onError:(e:unknown)=>setMessage(extractApiErrorMessage(e,'No se pudieron guardar los permisos.'))};
 const saveModules=useMutation({...mutationOptions,mutationFn:()=>modulePermissionsApi.save(moduleRows.filter(r=>canMutateRole(r.role)))});
 const saveActions=useMutation({...mutationOptions,mutationFn:()=>actionPermissionsApi.save(actionRows.filter(r=>canMutateRole(r.role))),onSuccess:async()=>{setMessage('Acciones guardadas.');await invalidate();}});
 const saveMenus=useMutation({...mutationOptions,mutationFn:()=>rolesApi.saveMenus(menuRows.filter(r=>canMutateRole(r.role)))});
 const roleRows=roles.isSuccess?roles.data:[];const definitions=catalog.data?.actions??[];
 const changeModule=(role:string,moduleCode:string,field:'canView'|'canWrite')=>{if(!canMutateRole(role))return;setModuleRows(prev=>prev.map(r=>r.role===role&&r.moduleCode===moduleCode?{...r,[field]:!r[field],...(field==='canView'&&r.canView?{canWrite:false}:{}),...(field==='canWrite'&&!r.canView?{canView:true}:{})}:r));};
 const changing=saveModules.isPending||saveActions.isPending||saveMenus.isPending;
 const failure=roles.isError||catalog.isError||modules.isError||actions.isError||menus.isError||config.isError;
 const canSave=roles.isSuccess&&catalog.isSuccess&&!failure&&!changing;
 const selectedMenuRole=menuRole||roleRows.find(r=>r.code!=='ADMIN')?.code||roleRows[0]?.code||'';
 return <Page><PageHeader title="Roles y permisos" description="Roles de empresa, módulos, menús y acciones. ADMIN permanece protegido."/>
  {roles.isLoading?<p role="status">Cargando roles…</p>:null}
  {failure?<p role="alert">No se pudieron consultar todos los permisos. El guardado permanece bloqueado.</p>:null}
  {message?<p role={saveModules.isError||saveActions.isError||saveMenus.isError?'alert':'status'}>{message}</p>:null}
  <RoleMaintainer roles={roleRows} customEnabled={config.isSuccess&&config.data.customRolesEnabled}/>
  <section aria-labelledby="modules-title" className="mt-6 space-y-3"><h2 id="modules-title" className="text-sm font-semibold">Módulos</h2><Card flush className="overflow-x-auto"><Table>
   <TableHeader><TableRow><TableHead>Rol</TableHead>{MODULES_PERMISOS.map(([code,name])=><TableHead key={code}><span title={name}>{code}</span></TableHead>)}</TableRow></TableHeader>
   <TableBody>{roleRows.map(role=><TableRow key={role.code}><TableCell>{role.name}<small className="block">{role.code}</small></TableCell>{MODULES_PERMISOS.map(([code])=>{
    const row=moduleRows.find(r=>r.role===role.code&&r.moduleCode===code);return <TableCell key={code}>{(['canView','canWrite'] as const).map(field=><label key={field} className="flex items-center gap-1 text-xs"><input type="checkbox" aria-label={`${role.code} ${code} ${field==='canView'?'ver':'escribir'}`} checked={row?.[field]??false} disabled={!canMutateRole(role.code)||!row||changing||!canSave} onChange={()=>changeModule(role.code,code,field)}/>{field==='canView'?'Ver':'Editar'}</label>)}</TableCell>;
   })}</TableRow>)}</TableBody>
  </Table></Card><Button size="sm" disabled={!canSave||!modules.isSuccess||moduleRows.length===0} onClick={()=>saveModules.mutate()}>Guardar permisos</Button></section>
  <section aria-labelledby="actions-title" className="mt-6 space-y-3"><h2 id="actions-title" className="text-sm font-semibold">Acciones</h2><p className="text-xs text-muted-foreground">Las acciones con un permiso de acceso adicional requieren ambas concesiones. ADMIN permanece protegido.</p>
   <Card flush className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Rol</TableHead>{definitions.map(a=><TableHead key={a.code}>{a.name}{a.accessGate?<small className="block text-xs font-normal">Requiere también: {definitions.find(d=>d.code===a.accessGate)?.name??a.accessGate}</small>:null}</TableHead>)}</TableRow></TableHeader><TableBody>{roleRows.map(role=><TableRow key={role.code}><TableCell>{role.name}</TableCell>{definitions.map(a=>{
    const row=actionRows.find(r=>r.role===role.code&&r.actionCode===a.code);
    return <TableCell key={a.code}><input type="checkbox" aria-label={`${role.code} ${a.code}`} checked={row?.allowed??false} disabled={!canMutateRole(role.code)||!row||!canSave||a.reservedAdmin} onChange={()=>{if(canMutateRole(role.code))setActionRows(prev=>prev.map(r=>r===row?{...r,allowed:!r.allowed}:r));}}/></TableCell>;
   })}</TableRow>)}</TableBody></Table></Card><Button size="sm" disabled={!canSave||!actions.isSuccess||actionRows.length===0} onClick={()=>saveActions.mutate()}>Guardar acciones</Button>
  </section>
  <section aria-labelledby="menus-title" className="mt-6 space-y-3"><h2 id="menus-title" className="text-sm font-semibold">Menús</h2><p className="text-xs text-muted-foreground">La visibilidad requiere el módulo y los menús padre. No concede escritura ni acciones.</p>
   <label className="text-xs">Rol para menús<select aria-label="Rol para menús" className="ml-2 rounded border bg-background p-2" value={selectedMenuRole} onChange={e=>setMenuRole(e.target.value)}>{roleRows.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
   <Card flush><Table><TableHeader><TableRow><TableHead>Menú / ruta</TableHead><TableHead>Módulo</TableHead><TableHead>Ver</TableHead></TableRow></TableHeader><TableBody>{(catalog.data?.menus??[]).map(menu=>{
    const row=menuRows.find(r=>r.role===selectedMenuRole&&r.menuCode===menu.code);return <TableRow key={menu.code}><TableCell><span className="text-xs">{menu.path}</span><small className="block text-muted-foreground">{menu.code}</small></TableCell><TableCell>{menu.moduleCode}</TableCell><TableCell><input type="checkbox" aria-label={`${selectedMenuRole} ${menu.code} ver`} checked={row?.canView??false} disabled={!canMutateRole(selectedMenuRole)||menu.reservedAdmin||!row||!canSave} onChange={()=>{if(canMutateRole(selectedMenuRole))setMenuRows(prev=>prev.map(r=>r===row?{...r,canView:!r.canView}:r));}}/></TableCell></TableRow>;
   })}</TableBody></Table></Card><Button size="sm" disabled={!canSave||!menus.isSuccess||menuRows.length===0} onClick={()=>saveMenus.mutate()}>Guardar menús</Button>
  </section>
 </Page>;
}
