import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,renderHook,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useActionPermissions } from '@/modules/auth/hooks/useActionPermissions';
import { actionPermissionsApi } from '@/modules/auth/services/actionPermissionsApi';
vi.mock('@/modules/auth/services/actionPermissionsApi',async importOriginal=>({...await importOriginal<typeof import('@/modules/auth/services/actionPermissionsApi')>(),actionPermissionsApi:{mine:vi.fn(),list:vi.fn(),save:vi.fn()}}));
const clients:QueryClient[]=[];
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(client);return renderHook(()=>useActionPermissions(),{wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});}
beforeEach(()=>{vi.resetAllMocks();useAuthStore.setState({user:{id:'a',email:'a@example.invalid',role:'ADMIN',companyId:'empresa-a'},activeCompany:null});});
afterEach(()=>{cleanup();clients.splice(0).forEach(c=>c.clear());useAuthStore.setState({user:null,activeCompany:null});});
it('ADMIN respeta la denegación del servidor, sin defaults de acciones en el cliente',async()=>{
 vi.mocked(actionPermissionsApi.mine).mockResolvedValue([{role:'ADMIN',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:false}]);
 const h=mount();expect(h.result.current.can('INVOICE_EDIT_ISSUE_DATE')).toBe(false);
 await waitFor(()=>expect(h.result.current.ready).toBe(true));expect(h.result.current.can('INVOICE_EDIT_ISSUE_DATE')).toBe(false);expect(h.result.current.can('INVOICE_FORCE_RESEND')).toBe(false);
});
it('solo habilita acciones explícitamente permitidas y bloquea mientras carga',async()=>{
 let resolve!:(rows:any)=>void;vi.mocked(actionPermissionsApi.mine).mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const h=mount();expect(h.result.current.isLoading).toBe(true);expect(h.result.current.can('INVOICE_RESOLVE_DLQ')).toBe(false);
 resolve([{role:'ADMIN',actionCode:'INVOICE_RESOLVE_DLQ',allowed:true}]);await waitFor(()=>expect(h.result.current.can('INVOICE_RESOLVE_DLQ')).toBe(true));
});
it('error o respuesta inválida no otorgan acciones',async()=>{
 vi.mocked(actionPermissionsApi.mine).mockRejectedValue(new Error('sin conexión'));
 const h=mount();await waitFor(()=>expect(h.result.current.isError).toBe(true));expect(h.result.current.can('INVOICE_FORCE_RESEND')).toBe(false);
});
it('no consulta sin usuario y no conserva acciones después de logout',async()=>{
 useAuthStore.setState({user:null});const h=mount();expect(h.result.current.actions).toEqual([]);expect(actionPermissionsApi.mine).not.toHaveBeenCalled();
});
it('separa caché por usuario, rol y empresa',async()=>{
 vi.mocked(actionPermissionsApi.mine).mockResolvedValueOnce([{role:'ADMIN',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:true}]).mockResolvedValue([]);
 const h=mount();await waitFor(()=>expect(h.result.current.can('INVOICE_EDIT_ISSUE_DATE')).toBe(true));
 useAuthStore.setState({user:{id:'b',email:'b@example.invalid',role:'OPERADOR_FACTURACION',companyId:'empresa-b'}});
 await waitFor(()=>expect(h.result.current.can('INVOICE_EDIT_ISSUE_DATE')).toBe(false));await waitFor(()=>expect(actionPermissionsApi.mine).toHaveBeenCalledTimes(2));
});
