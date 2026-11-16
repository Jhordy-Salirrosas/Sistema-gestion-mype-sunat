import { TEST_ACTIONS as ACTIONS_PERMISOS,serverSnapshot } from '../../../fixtures/permissionsServer';
import { permissionsApi } from '@/modules/auth/services/permissionsApi';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,render,renderHook,screen,fireEvent,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { type ActionCode } from '@/modules/auth/services/actionPermissionsApi';
import { modulePermissionsApi } from '@/modules/auth/services/modulePermissionsApi';
import { useInvoiceWritePermission } from '@/modules/invoices/hooks/useInvoiceWritePermission';
import { InvoiceWriteButton } from '@/modules/invoices/components/InvoiceWriteButton';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { InvoiceBridgeReprocess } from '@/modules/invoices/components/InvoiceBridgeReprocess';
import { InvoiceForcedResend } from '@/modules/invoices/components/InvoiceForcedResend';
import { hoyEnLima } from '@/modules/invoices/lib/invoiceFecha';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async(url:string)=>({data:url.includes('/invoices/config')?{series:[{document_type:'01',series:'F001',is_active:true}]}:[]})),post:vi.fn()}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[])}));
const clients:QueryClient[]=[];
function wrapper(){const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);return {q,Wrapper:({children}:{children:ReactNode})=><MemoryRouter><QueryClientProvider client={q}>{children}</QueryClientProvider></MemoryRouter>};}
const actions=(allowed:boolean)=>ACTIONS_PERMISOS.map(([actionCode])=>({role:'ADMIN',actionCode,allowed,available:true}));
beforeEach(()=>{
 useAuthStore.setState({user:{id:'admin',email:'admin@example.invalid',role:'ADMIN',companyId:'empresa'},activeCompany:null});
 vi.mocked(modulePermissionsApi.mine).mockResolvedValue([{role:'ADMIN',moduleCode:'M1',canView:true,canWrite:true}]);
 vi.mocked(permissionsApi.mine).mockResolvedValue({...serverSnapshot(),actions:actions(false)});
});
afterEach(()=>{cleanup();clients.splice(0).forEach(q=>q.clear());vi.resetAllMocks();useAuthStore.setState({user:null,activeCompany:null});});
it.each(['pagina','modal'])('%s: fecha readonly con explicación, sin modificar el día del borrador',async via=>{
 const {Wrapper}=wrapper();render(via==='pagina'?<InvoiceEmissionPage/>:<InvoiceEmitModal tipoInicial="01" fecha={hoyEnLima()} existentes={[]} seriesConfiguradas={[{document_type:'01',series:'F001',is_active:true}]} onEmitir={vi.fn()} onCerrar={vi.fn()}/>,{wrapper:Wrapper});
 const input=screen.getByLabelText('Fecha de emisión') as HTMLInputElement;
 await screen.findByText(/La fecha de emisión es de solo lectura/);expect(input.readOnly).toBe(true);
 const original=input.value;fireEvent.change(input,{target:{value:'2020-01-01'}});expect(input.value).toBe(original);
 expect(input.getAttribute('aria-describedby')).toBeTruthy();
});
it('la concesión del servidor permite modificar la fecha para el operador',async()=>{
 useAuthStore.setState({user:{id:'op',email:'op@example.invalid',role:'OPERADOR_FACTURACION'}});
 vi.mocked(modulePermissionsApi.mine).mockResolvedValue([{role:'OPERADOR_FACTURACION',moduleCode:'M1',canView:true,canWrite:true}]);
 vi.mocked(permissionsApi.mine).mockResolvedValue({...serverSnapshot(),actions:[{role:'OPERADOR_FACTURACION',actionCode:'INVOICE_EDIT_ISSUE_DATE',allowed:true}]});
 const {Wrapper}=wrapper();render(<InvoiceEmissionPage/>,{wrapper:Wrapper});
 await waitFor(()=>expect((screen.getByLabelText('Fecha de emisión') as HTMLInputElement).readOnly).toBe(false));
});
it('error de acciones mantiene fecha readonly y muestra la explicación',async()=>{
 vi.mocked(permissionsApi.mine).mockRejectedValue(new Error('fallo de red'));
 const {Wrapper}=wrapper();render(<InvoiceEmissionPage/>,{wrapper:Wrapper});await screen.findByText(/No se pudo consultar el permiso/);expect((screen.getByLabelText('Fecha de emisión') as HTMLInputElement).readOnly).toBe(true);
});
it.each(['INVOICE_FORCE_RESEND','INVOICE_RESOLVE_DLQ','INVOICE_REPROCESS_BRIDGE'] as ActionCode[])('botón %s respeta acción, escritura y sus condiciones previas',async action=>{
 const {Wrapper,q}=wrapper();const onClick=vi.fn();render(<InvoiceWriteButton action={action} onClick={onClick}>Operar</InvoiceWriteButton>,{wrapper:Wrapper});
 await waitFor(()=>expect(permissionsApi.mine).toHaveBeenCalled());const button=screen.getByRole('button',{name:'Operar'}) as HTMLButtonElement;
 expect(button.disabled).toBe(true);fireEvent.click(button);expect(onClick).not.toHaveBeenCalled();
 vi.mocked(permissionsApi.mine).mockResolvedValue({...serverSnapshot(),actions:actions(true)});await q.invalidateQueries({queryKey:['permissions-me']});
 await waitFor(()=>expect(button.disabled).toBe(false));fireEvent.click(button);expect(onClick).toHaveBeenCalledTimes(1);
});
it('una matriz M1 denegada bloquea ADMIN y se conserva el rol exigido por los endpoints',async()=>{
 vi.mocked(permissionsApi.mine).mockResolvedValue({...serverSnapshot(),modules:[{role:'ADMIN',moduleCode:'M1',canView:true,canWrite:false}]});
 const {Wrapper}=wrapper();const h=renderHook(()=>useInvoiceWritePermission(),{wrapper:Wrapper});await waitFor(()=>expect(permissionsApi.mine).toHaveBeenCalled());expect(h.result.current).toBe(false);
});
it('reenvío forzado y puente mantienen ADMIN/estado y añaden la acción',async()=>{
 const {Wrapper}=wrapper();render(<><InvoiceForcedResend id="i" incierto/><InvoiceBridgeReprocess id="i" estado="ACEPTADO"/></>,{wrapper:Wrapper});
 fireEvent.change(await screen.findByLabelText('Motivo del reenvío forzado'),{target:{value:'Decisión registrada'}});
 fireEvent.click(screen.getByRole('checkbox',{name:/Confirmo explícitamente/}));
 await waitFor(()=>expect(permissionsApi.mine).toHaveBeenCalled());
 expect((screen.getByRole('button',{name:'Autorizar reenvío forzado'}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole('button',{name:'Reprocesar puente'}) as HTMLButtonElement).disabled).toBe(true);
});
