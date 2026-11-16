import { UserNavDropdown } from '@/components/layout/UserNavDropdown';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,render,renderHook,screen,fireEvent,waitFor,act } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';
import { rolesApi,type CompanyRole } from '@/modules/auth/services/rolesApi';
import { permissionsApi } from '@/modules/auth/services/permissionsApi';
import { modulePermissionsApi } from '@/modules/auth/services/modulePermissionsApi';
import { actionPermissionsApi } from '@/modules/auth/services/actionPermissionsApi';
import RolePermissionsPage from '@/modules/auth/pages/RolePermissionsPage';
import { RoleMaintainer } from '@/modules/auth/components/RoleMaintainer';
import UserWarehousesPage from '@/modules/auth/pages/UserWarehousesPage';
import { RoleProtectedRoute } from '@/routes/RoleProtectedRoute';
import { serverSnapshot,serverRoleRows,serverCatalog,serverMenuRows } from '../../../fixtures/permissionsServer';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:[]})),post:vi.fn(),put:vi.fn(),patch:vi.fn()}}));
const clients:QueryClient[]=[];
function wrapper(path='/sales/pos'){const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);return {q,Wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={q}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></QueryClientProvider>};}
beforeEach(()=>{useAuthStore.setState({user:{id:'admin',email:'admin@example.invalid',role:'ADMIN',companyId:'empresa'},token:'sesion-vigente',activeCompany:null});vi.mocked(permissionsApi.mine).mockImplementation(async()=>serverSnapshot());vi.mocked(rolesApi.list).mockResolvedValue(serverRoleRows());vi.mocked(rolesApi.catalog).mockResolvedValue(serverCatalog());vi.mocked(rolesApi.menus).mockResolvedValue(serverMenuRows());vi.mocked(rolesApi.config).mockResolvedValue({customRolesEnabled:false});});
afterEach(()=>{cleanup();clients.splice(0).forEach(q=>q.clear());vi.restoreAllMocks();useAuthStore.setState({user:null,token:null});});
it('editor usa roles y nombres nuevos de la API, pero no permite asignar/grabar propios con flag apagado',async()=>{
 const roles:CompanyRole[]=[...serverRoleRows(),{code:'SUPERVISOR_2026',name:'Supervisor de turno',isSystem:false}];vi.mocked(rolesApi.list).mockResolvedValue(roles);
 const modules=roles.flatMap(r=>Array.from({length:10},(_,i)=>({role:r.code,moduleCode:`M${i+1}`,canView:r.isSystem,canWrite:r.isSystem})));
 const actions=roles.flatMap(r=>serverCatalog().actions.map(a=>({role:r.code,actionCode:a.code,allowed:r.isSystem&&r.code==='ADMIN'})));
 vi.spyOn(modulePermissionsApi,'list').mockResolvedValue(modules);vi.spyOn(modulePermissionsApi,'save').mockImplementation(async data=>data);vi.spyOn(actionPermissionsApi,'list').mockResolvedValue(actions);
 const {Wrapper}=wrapper();render(<RolePermissionsPage/>,{wrapper:Wrapper});await screen.findByLabelText('Nombre del rol SUPERVISOR_2026');expect((screen.getByRole('checkbox',{name:'SUPERVISOR_2026 M1 escribir'}) as HTMLInputElement).disabled).toBe(true);
 expect((screen.getByLabelText('Nombre del rol ADMIN') as HTMLInputElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'Crear rol'}) as HTMLButtonElement).disabled).toBe(true);
 await waitFor(()=>expect((screen.getByRole('button',{name:'Guardar permisos'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Guardar permisos'}));await screen.findByText('Permisos guardados.');const rows=vi.mocked(modulePermissionsApi.save).mock.calls[0][0];expect(rows.some(r=>r.role==='ADMIN'||r.role==='SUPERVISOR_2026')).toBe(false);
});
it('renombrado envía solo el nombre, refresca catálogo y conserva sesión',async()=>{
 const roles=serverRoleRows();let name='Contador';vi.mocked(rolesApi.list).mockImplementation(async()=>roles.map(r=>r.code==='CONTADOR'?{...r,name}:r));const rename=vi.spyOn(rolesApi,'rename').mockImplementation(async(code,next)=>{name=next;return {code,name:next,isSystem:true};});
 // El editor de nombres se verifica aislado; la invalidación se observa en el cliente real.
 const {Wrapper,q}=wrapper();const invalidate=vi.spyOn(q,'invalidateQueries');render(<RoleMaintainer roles={roles} customEnabled={false}/>,{wrapper:Wrapper});
 fireEvent.change(screen.getByLabelText('Nombre del rol CONTADOR'),{target:{value:'Contabilidad central'}});fireEvent.click(screen.getByRole('button',{name:'Renombrar CONTADOR'}));await screen.findByText('Nombre del rol actualizado.');expect(rename).toHaveBeenCalledWith('CONTADOR','Contabilidad central');expect(invalidate).toHaveBeenCalledWith({queryKey:['roles']});expect(invalidate).toHaveBeenCalledWith({queryKey:['permissions-me']});expect(useAuthStore.getState().token).toBe('sesion-vigente');
});
it('el nombre vigente cambia en la sesión sin renovar token ni cerrar sesión',async()=>{
 useAuthStore.setState({user:{id:'cont',email:'cont@example.invalid',role:'CONTADOR',companyId:'empresa'}});let name='Contador';vi.mocked(permissionsApi.mine).mockImplementation(async()=>({...serverSnapshot(),role:{code:'CONTADOR',name,isSystem:true}}));const {Wrapper,q}=wrapper();const h=renderHook(()=>useServerPermissions(),{wrapper:Wrapper});render(<UserNavDropdown/>,{wrapper:Wrapper});await waitFor(()=>expect(h.result.current.ready).toBe(true));name='Contabilidad central';await act(async()=>{await q.invalidateQueries({queryKey:['permissions-me']});});await waitFor(()=>expect(useAuthStore.getState().user?.roleName).toBe('Contabilidad central'));expect(await screen.findByText('Contabilidad central')).toBeTruthy();expect(useAuthStore.getState().token).toBe('sesion-vigente');
});
it('usuarios lista nombres del catálogo, manteniendo roles propios fuera de asignación hasta el corte',async()=>{
 vi.mocked(rolesApi.list).mockResolvedValue([...serverRoleRows().map(r=>r.code==='CONTADOR'?{...r,name:'Contabilidad central'}:r),{code:'PROPIO',name:'Turno de caja',isSystem:false}]);const {Wrapper}=wrapper();render(<UserWarehousesPage/>,{wrapper:Wrapper});expect(await screen.findByRole('option',{name:'Contabilidad central (CONTADOR)'})).toBeTruthy();expect(screen.queryByRole('option',{name:/Turno de caja/})).toBeNull();
});
it('rol nuevo sin permisos no hereda por llamarse Administrador y no accede a ruta directa',async()=>{
 useAuthStore.setState({user:{id:'nuevo',email:'nuevo@example.invalid',role:'PROPIO',companyId:'empresa'}});vi.mocked(permissionsApi.mine).mockResolvedValue({...serverSnapshot(),role:{code:'PROPIO',name:'Administrador',isSystem:false}});const {Wrapper}=wrapper();render(<RoleProtectedRoute><button>Operación privada</button></RoleProtectedRoute>,{wrapper:Wrapper});await screen.findByText('Módulo Restringido');expect(screen.queryByText('Operación privada')).toBeNull();
});
it('carga y error posterior a una concesión deniegan, incluso con datos en caché',async()=>{
 let resolve!:(value:ReturnType<typeof serverSnapshot>)=>void;vi.mocked(permissionsApi.mine).mockImplementation(()=>new Promise(r=>{resolve=r;}));const {Wrapper,q}=wrapper();const h=renderHook(()=>useServerPermissions(),{wrapper:Wrapper});expect(h.result.current.canNavigate('/sales/pos')).toBe(false);expect(h.result.current.canAction('INVOICE_EMIT')).toBe(false);resolve(serverSnapshot());await waitFor(()=>expect(h.result.current.canNavigate('/sales/pos')).toBe(true));vi.mocked(permissionsApi.mine).mockRejectedValue(new Error('red caída'));await act(async()=>{await q.invalidateQueries({queryKey:['permissions-me']});});await waitFor(()=>expect(h.result.current.isError).toBe(true));expect(h.result.current.canNavigate('/sales/pos')).toBe(false);expect(h.result.current.canWrite('M1')).toBe(false);expect(h.result.current.homePath).toBe(null);
});

it.each(['ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR','ACCOUNTANT','OPERATOR'])('%s recibe las 72 decisiones de navegación del servidor, con alias normalizado',async role=>{
 useAuthStore.getState().setSession('sesion-vigente',{id:role,email:role+'@example.invalid',role});const expected=serverSnapshot();vi.mocked(permissionsApi.mine).mockResolvedValue(expected);const {Wrapper}=wrapper();const h=renderHook(()=>useServerPermissions(),{wrapper:Wrapper});await waitFor(()=>expect(h.result.current.ready).toBe(true));for(const menu of expected.menus)expect(h.result.current.canNavigate(menu.path.replace(':id','expediente-1'))).toBe(menu.canView);expect(h.result.current.homePath).toBe(expected.homePath);expect(useAuthStore.getState().user?.role).toBe(role==='ACCOUNTANT'?'CONTADOR':role==='OPERATOR'?'OPERADOR_FACTURACION':role);
});

it('edita menús por código y guarda únicamente la matriz de menús, sin ADMIN',async()=>{
 vi.spyOn(modulePermissionsApi,'list').mockResolvedValue([]);const moduleSave=vi.spyOn(modulePermissionsApi,'save');vi.spyOn(actionPermissionsApi,'list').mockResolvedValue([]);const actionSave=vi.spyOn(actionPermissionsApi,'save');const save=vi.spyOn(rolesApi,'saveMenus').mockImplementation(async rows=>rows);
 const {Wrapper}=wrapper();render(<RolePermissionsPage/>,{wrapper:Wrapper});await screen.findByRole('option',{name:'Operador de facturación'});fireEvent.change(screen.getByRole('combobox',{name:'Rol para menús'}),{target:{value:'OPERADOR_FACTURACION'}});
 const input=await screen.findByRole('checkbox',{name:'OPERADOR_FACTURACION MENU_INVOICES_EMISION ver'});await waitFor(()=>expect((input as HTMLInputElement).disabled).toBe(false));fireEvent.click(input);fireEvent.click(screen.getByRole('button',{name:'Guardar menús'}));await screen.findByText('Permisos guardados.');const rows=save.mock.calls[0][0];expect(rows.some(r=>r.role==='ADMIN')).toBe(false);expect(rows.find(r=>r.role==='OPERADOR_FACTURACION'&&r.menuCode==='MENU_INVOICES_EMISION')?.canView).toBe(false);expect(moduleSave).not.toHaveBeenCalled();expect(actionSave).not.toHaveBeenCalled();
});
