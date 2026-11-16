import { TEST_ACTIONS as ACTIONS_PERMISOS, TEST_ROLES as ROLES_PERMISOS } from '../../../fixtures/permissionsServer';
import { useAuthStore } from '@/stores/authStore';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import RolePermissionsPage from '@/modules/auth/pages/RolePermissionsPage';
import { actionPermissionsApi } from '@/modules/auth/services/actionPermissionsApi';
import { modulePermissionsApi } from '@/modules/auth/services/modulePermissionsApi';
vi.mock('@/modules/auth/services/modulePermissionsApi',async original=>{const a=await original<typeof import('@/modules/auth/services/modulePermissionsApi')>();return {...a,modulePermissionsApi:{list:vi.fn(),save:vi.fn()}};});
vi.mock('@/modules/auth/services/actionPermissionsApi',async original=>{const a=await original<typeof import('@/modules/auth/services/actionPermissionsApi')>();return {...a,actionPermissionsApi:{list:vi.fn(),save:vi.fn()}};});
let q:QueryClient;
const rows=()=>ROLES_PERMISOS.flatMap(role=>ACTIONS_PERMISOS.map(([actionCode])=>({role,actionCode,allowed:role==='ADMIN'&&actionCode!=='INVOICE_FORCE_RESEND'})));
beforeEach(()=>{useAuthStore.setState({user:{id:'admin',email:'admin@example.invalid',role:'ADMIN'}});q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});vi.mocked(modulePermissionsApi.list).mockResolvedValue([]);vi.mocked(actionPermissionsApi.list).mockResolvedValue(rows());});
afterEach(()=>{cleanup();q.clear();vi.resetAllMocks();});
function mount(){render(<QueryClientProvider client={q}><RolePermissionsPage/></QueryClientProvider>);}
it('muestra el catálogo de acciones por rol y ADMIN bloqueado, incluso una denegación persistida',async()=>{
 mount();await waitFor(()=>expect((screen.getByRole('checkbox',{name:'CONTADOR INVOICE_EDIT_ISSUE_DATE'}) as HTMLInputElement).disabled).toBe(false));
 const section=within(screen.getByRole('region',{name:'Acciones'}));const inputs=section.getAllByRole('checkbox') as HTMLInputElement[];
 const admin=inputs.filter(input=>input.getAttribute('aria-label')?.startsWith('ADMIN '));expect(admin).toHaveLength(ACTIONS_PERMISOS.length);
 for(const input of admin){expect(input.disabled).toBe(true);expect(input.checked).toBe(input.getAttribute('aria-label')!=='ADMIN INVOICE_FORCE_RESEND');}
 fireEvent.click(admin[0]);expect(admin[0].disabled).toBe(true);expect(inputs).toHaveLength(ACTIONS_PERMISOS.length*5);
});
it('guarda cambios no ADMIN e invalida las acciones efectivas del usuario',async()=>{
 vi.mocked(actionPermissionsApi.save).mockImplementation(async data=>[...rows().filter(r=>r.role==='ADMIN'),...data]);const invalidate=vi.spyOn(q,'invalidateQueries');
 mount();const field=await screen.findByRole('checkbox',{name:'OPERADOR_FACTURACION INVOICE_EDIT_ISSUE_DATE'});
 await waitFor(()=>expect((field as HTMLInputElement).disabled).toBe(false));fireEvent.click(field);fireEvent.click(screen.getByRole('button',{name:'Guardar acciones'}));
 await screen.findByText('Acciones guardadas.');const payload=vi.mocked(actionPermissionsApi.save).mock.calls[0][0];expect(payload).toHaveLength(ACTIONS_PERMISOS.length*4);expect(payload.some(r=>r.role==='ADMIN')).toBe(false);expect(payload.find(r=>r.role==='OPERADOR_FACTURACION'&&r.actionCode==='INVOICE_EDIT_ISSUE_DATE')?.allowed).toBe(true);expect(invalidate).toHaveBeenCalledWith({queryKey:['action-permissions-me']});
});
it('expone el rechazo al guardar sin anunciar éxito',async()=>{
 vi.mocked(actionPermissionsApi.save).mockRejectedValue({response:{status:403,data:{message:'Acceso denegado'}}});mount();await waitFor(()=>expect((screen.getByRole('button',{name:'Guardar acciones'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Guardar acciones'}));expect((await screen.findByRole('alert')).textContent).toContain('Acceso denegado');expect(screen.queryByText('Acciones guardadas.')).toBeNull();
});
it('fallo de consulta deja el editor sin posibilidad de guardar',async()=>{
 vi.mocked(actionPermissionsApi.list).mockRejectedValue(new Error('red'));mount();await screen.findByRole('alert');expect((screen.getByRole('button',{name:'Guardar acciones'}) as HTMLButtonElement).disabled).toBe(true);expect(actionPermissionsApi.save).not.toHaveBeenCalled();
});
