import { useEffect,useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { permissionsApi } from '../services/permissionsApi';
import { usePermissionsIdentity } from './usePermissionsIdentity';
import { useAuthStore } from '@/stores/authStore';
import { getApiErrorStatus, getApiRetryAfterMs } from '@/lib/apiErrors';

// La pausa pertenece a la consulta: se comparte entre observadores y se
// libera junto con su caché, sin mezclar usuarios ni empresas.
const permissionPauses = new WeakMap<object, { until: number; error: unknown }>();
const remainingPause = (query: object) => Math.max(0, (permissionPauses.get(query)?.until ?? 0) - Date.now());

const cleanPath=(path:string)=>path.split('?')[0].replace(/\/+$/,'')||'/';
function matches(pattern:string,path:string){
 const expression=pattern.split('/').map(part=>part.startsWith(':')?'[^/]+':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/');
 return new RegExp('^'+expression+'$','i').test(path);
}
export function useServerPermissions(){
 const {user,scope}=usePermissionsIdentity();
 const client=useQueryClient();
 const queryKey=['permissions-me',...scope];
 const query=useQuery({queryKey,queryFn:async()=>{
  const current=client.getQueryCache().find({queryKey,exact:true});
  const pause=current&&permissionPauses.get(current);
  if(pause&&pause.until>Date.now())throw pause.error;
  if(current)permissionPauses.delete(current);
  try{return await permissionsApi.mine();}catch(error){
   if(current&&getApiErrorStatus(error)===429)permissionPauses.set(current,{until:Date.now()+getApiRetryAfterMs(error),error});
   throw error;
  }
 },enabled:Boolean(user),retry:false,staleTime:15_000,
 refetchInterval:q=>{const pause=remainingPause(q);return pause>0?Math.min(2_147_483_647,pause):30_000;},
 refetchOnMount:q=>remainingPause(q)===0,
 refetchOnReconnect:q=>remainingPause(q)===0,
 refetchOnWindowFocus:false});
 const data=query.data;
 const valid=Boolean(data&&typeof data.role?.code==='string'&&typeof data.role?.name==='string'&&Array.isArray(data.modules)&&data.modules.every(m=>m&&typeof m.canView==='boolean'&&typeof m.canWrite==='boolean')&&Array.isArray(data.actions)&&data.actions.every(a=>a&&typeof a.actionCode==='string'&&typeof a.allowed==='boolean')&&Array.isArray(data.menus)&&data.menus.every(m=>m&&typeof m.path==='string'&&typeof m.canView==='boolean'));
 const ready=Boolean(user)&&query.isSuccess&&valid;
 useEffect(()=>{
  if(ready&&data&&user&&(user.role!==data.role.code||user.roleName!==data.role.name))useAuthStore.getState().updateUser({role:data.role.code,roleName:data.role.name});
 },[ready,data,user]);
 const canNavigate=useCallback((path:string)=>{
  if(!ready||!data)return false;const target=cleanPath(path);
  const exact=[...data.menus].sort((a,b)=>b.path.split('/').filter(x=>!x.startsWith(':')).length-a.path.split('/').filter(x=>!x.startsWith(':')).length).find(menu=>matches(menu.path,target));
  if(exact)return exact.canView;
  return data.menus.some(menu=>menu.canView&&(target==='/'||menu.path.toLowerCase().startsWith(target.toLowerCase()+'/')));
 },[ready,data]);
 return {errorStatus:getApiErrorStatus(query.error),ready,isLoading:Boolean(user)&&query.isPending,isError:query.isError||(query.isSuccess&&!valid),snapshot:ready?data:undefined,
  actions:ready?data!.actions:[],canAction:(code:string)=>ready&&data!.actions.some(a=>a.actionCode===code&&a.allowed),
  canView:(moduleCode:string)=>ready&&data!.modules.some(m=>m.moduleCode===moduleCode&&m.canView),
  canWrite:(moduleCode:string)=>ready&&data!.modules.some(m=>m.moduleCode===moduleCode&&m.canWrite),
  canNavigate,homePath:ready?data!.homePath:null,refetch:query.refetch,
 };
}
