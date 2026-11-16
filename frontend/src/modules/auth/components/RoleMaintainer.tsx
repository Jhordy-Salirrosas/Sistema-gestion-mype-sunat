import { useEffect,useState } from 'react';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { Button,Card } from '@/components/ui';
import { extractApiErrorMessage } from '@/lib/apiErrors';
import { rolesApi,type CompanyRole } from '../services/rolesApi';
export function RoleMaintainer({roles,customEnabled}:{roles:CompanyRole[];customEnabled:boolean}){
 const q=useQueryClient();const [names,setNames]=useState<Record<string,string>>({});const [message,setMessage]=useState('');const [code,setCode]=useState('');const [name,setName]=useState('');
 useEffect(()=>{setNames(Object.fromEntries(roles.map(r=>[r.code,r.name])));},[roles]);
 const refresh=async()=>{for(const key of ['roles','module-permissions','action-permissions','menu-permissions','permissions-me'])await q.invalidateQueries({queryKey:[key]});};
 const rename=useMutation({mutationFn:({code,name}:{code:string;name:string})=>rolesApi.rename(code,name),onSuccess:async()=>{setMessage('Nombre del rol actualizado.');await refresh();},onError:(e:unknown)=>setMessage(extractApiErrorMessage(e,'No se pudo renombrar el rol.'))});
 const create=useMutation({mutationFn:()=>rolesApi.create(code,name),onSuccess:async()=>{setMessage('Rol creado.');setCode('');setName('');await refresh();},onError:(e:unknown)=>setMessage(extractApiErrorMessage(e,'No se pudo crear el rol.'))});
 return <section aria-labelledby="roles-title" className="space-y-3"><h2 id="roles-title" className="text-sm font-semibold">Roles de la empresa</h2>
  <p className="text-xs text-muted-foreground">El código es fijo. Cambiar el nombre visible no modifica los permisos.</p>
  {message?<p role={rename.isError||create.isError?'alert':'status'}>{message}</p>:null}
  <Card className="space-y-3 p-3">{roles.map(role=><form key={role.code} className="grid gap-2 sm:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_auto] sm:items-end" onSubmit={event=>{event.preventDefault();if(role.code!=='ADMIN'&&!rename.isPending)rename.mutate({code:role.code,name:names[role.code]??role.name});}}>
   <span className="min-w-0 break-words text-xs">{role.code}{role.isSystem?' · Sistema':''}</span>
   <label className="min-w-0 break-words text-xs">Nombre del rol {role.code}<input className="mt-1 block w-full rounded border bg-background p-2" value={names[role.code]??role.name} onChange={e=>setNames({...names,[role.code]:e.target.value})} required maxLength={100} disabled={role.code==='ADMIN'||rename.isPending}/></label>
   <Button className="w-fit" size="sm" type="submit" disabled={role.code==='ADMIN'||rename.isPending}>Renombrar {role.code}</Button>
  </form>)}</Card>
  <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" onSubmit={event=>{event.preventDefault();if(customEnabled&&!create.isPending)create.mutate();}}>
   <label className="text-xs">Código del nuevo rol<input className="mt-1 block w-full rounded border bg-background p-2" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} pattern="[A-Z][A-Z0-9_]{0,63}" maxLength={64} required disabled={!customEnabled||create.isPending}/></label>
   <label className="text-xs">Nombre del nuevo rol<input className="mt-1 block w-full rounded border bg-background p-2" value={name} onChange={e=>setName(e.target.value)} maxLength={100} required disabled={!customEnabled||create.isPending}/></label>
   <Button size="sm" type="submit" disabled={!customEnabled||create.isPending}>Crear rol</Button>
  </form>
  {!customEnabled?<p className="text-xs text-muted-foreground">La creación y asignación de roles propios no está habilitada.</p>:null}
 </section>;
}
