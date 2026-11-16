import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,renderHook,waitFor,act } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useActionPermissions } from '@/modules/auth/hooks/useActionPermissions';
import { permissionsApi } from '@/modules/auth/services/permissionsApi';
import { serverSnapshot } from '../../../fixtures/permissionsServer';
const clients:QueryClient[]=[];
function mount(){const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);return renderHook(()=>useActionPermissions(),{wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={q}>{children}</QueryClientProvider>});}
beforeEach(()=>{useAuthStore.setState({user:{id:'a',email:'a@example.invalid',role:'ADMIN',companyId:'empresa-a'},activeCompany:null});vi.mocked(permissionsApi.mine).mockImplementation(async()=>serverSnapshot());});
afterEach(()=>{cleanup();clients.splice(0).forEach(q=>q.clear());vi.clearAllMocks();useAuthStore.setState({user:null,activeCompany:null});});
it('ADMIN respeta la denegación del servidor, sin defaults locales',async()=>{
 vi.mocked(permissionsApi.mine).mockResolvedValue({...serverSnapshot(),actions:[{role:'ADMIN',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:false}]});const h=mount();expect(h.result.current.can('INVOICE_EDIT_ISSUE_DATE')).toBe(false);await waitFor(()=>expect(h.result.current.ready).toBe(true));expect(h.result.current.can('INVOICE_EDIT_ISSUE_DATE')).toBe(false);expect(h.result.current.can('INVOICE_FORCE_RESEND')).toBe(false);
});
it('solo habilita acciones explícitas y bloquea durante carga',async()=>{
 let resolve!:(value:unknown)=>void;vi.mocked(permissionsApi.mine).mockImplementation(()=>new Promise(r=>{resolve=r as typeof resolve;}));const h=mount();expect(h.result.current.isLoading).toBe(true);expect(h.result.current.can('INVOICE_RESOLVE_DLQ')).toBe(false);resolve({...serverSnapshot(),actions:[{role:'ADMIN',actionCode:'INVOICE_RESOLVE_DLQ',allowed:true}]});await waitFor(()=>expect(h.result.current.can('INVOICE_RESOLVE_DLQ')).toBe(true));
});
it.each(['red','respuesta inválida'])('un fallo de %s no otorga acciones',async kind=>{
 if(kind==='red')vi.mocked(permissionsApi.mine).mockRejectedValue(new Error('sin conexión'));else vi.mocked(permissionsApi.mine).mockResolvedValue({actions:[]} as never);
 const h=mount();await waitFor(()=>expect(h.result.current.isError).toBe(true));expect(h.result.current.can('INVOICE_FORCE_RESEND')).toBe(false);
});
it('no consulta sin usuario',()=>{useAuthStore.setState({user:null});const h=mount();expect(h.result.current.actions).toEqual([]);expect(permissionsApi.mine).not.toHaveBeenCalled();});
it('logout elimina las acciones efectivas aunque haya caché',async()=>{const h=mount();await waitFor(()=>expect(h.result.current.can('INVOICE_EMIT')).toBe(true));act(()=>useAuthStore.getState().logout());expect(h.result.current.actions).toEqual([]);expect(h.result.current.can('INVOICE_EMIT')).toBe(false);});
it('separa caché por usuario, rol y empresa',async()=>{
 const h=mount();await waitFor(()=>expect(h.result.current.can('INVOICE_EDIT_ISSUE_DATE')).toBe(true));act(()=>useAuthStore.setState({user:{id:'b',email:'b@example.invalid',role:'OPERADOR_FACTURACION',companyId:'empresa-b'}}));await waitFor(()=>expect(h.result.current.can('INVOICE_EDIT_ISSUE_DATE')).toBe(false));await waitFor(()=>expect(permissionsApi.mine).toHaveBeenCalledTimes(2));act(()=>useAuthStore.setState({activeCompany:{tenantId:'empresa-c',ruc:'',razonSocial:''}}));await waitFor(()=>expect(permissionsApi.mine).toHaveBeenCalledTimes(3));
});
