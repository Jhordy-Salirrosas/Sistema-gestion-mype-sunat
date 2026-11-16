import { afterEach,expect,it } from 'vitest';
import { cleanup,renderHook,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useAuthStore } from '@/stores/authStore';
const clients:QueryClient[]=[];
afterEach(()=>{cleanup();clients.splice(0).forEach(q=>q.clear());useAuthStore.getState().logout();});
it.each([
 ['ADMIN',true,true,true],['OPERADOR_ADUANAS',false,true,false],['OPERADOR_FACTURACION',true,false,false],['CONTADOR',false,false,true],['AUDITOR',false,false,false],['OPERATOR',true,false,false],['ACCOUNTANT',false,false,true],
] as const)('%s conserva emisión, DUA y contabilidad desde la matriz del servidor',async(role,emit,dua,entry)=>{
 useAuthStore.getState().setSession('token',{id:'test',email:'test@example.invalid',role});const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);const h=renderHook(()=>useRolePermissions(),{wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={q}>{children}</QueryClientProvider>});
 await waitFor(()=>expect(h.result.current.canEmitInvoices).toBe(emit));await waitFor(()=>expect(h.result.current.canRegisterDua).toBe(dua));await waitFor(()=>expect(h.result.current.canCreateAccountingEntry).toBe(entry));if(role==='AUDITOR'){expect(h.result.current.isReadOnly).toBe(true);expect(h.result.current.canExportPle).toBe(false);}if(entry){expect(h.result.current.canExportPle).toBe(true);expect(h.result.current.canReconcileSire).toBe(true);}
});
