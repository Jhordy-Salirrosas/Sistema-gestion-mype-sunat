import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import UserWarehousesPage from '@/modules/auth/pages/UserWarehousesPage';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(),post:vi.fn()}}));
let q:QueryClient;
const created={id:'nuevo',companyId:'empresa',email:'nuevo@example.invalid',fullName:'Nuevo usuario',role:'AUDITOR',isActive:true};
beforeEach(()=>{q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});useAuthStore.setState({user:{id:'admin',email:'admin@example.invalid',role:'ADMIN'}});vi.mocked(apiClient.get).mockResolvedValue({data:[]});vi.mocked(apiClient.post).mockResolvedValue({data:created});});
afterEach(()=>{cleanup();q.clear();vi.resetAllMocks();useAuthStore.setState({user:null});});
function mount(){render(<QueryClientProvider client={q}><UserWarehousesPage/></QueryClientProvider>);}
async function fill(){await screen.findByRole('option',{name:/Auditor \(AUDITOR\)/});fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Nuevo usuario'}});fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'nuevo@example.invalid'}});fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'Secreto123'}});fireEvent.change(screen.getByLabelText('Rol del nuevo usuario'),{target:{value:'AUDITOR'}});}
it('ADMIN crea con el contrato del servidor, limpia la contraseña y refresca la lista',async()=>{
 vi.mocked(apiClient.get).mockImplementation(async url=>({data:url==='/auth/users'&&vi.mocked(apiClient.post).mock.calls.length?[{...created,warehouseCodes:[]}]:[]}));const invalidate=vi.spyOn(q,'invalidateQueries');mount();await fill();fireEvent.click(screen.getByRole('button',{name:'Crear usuario'}));
 await screen.findByText('Usuario creado.');expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/auth/users',{name:'Nuevo usuario',email:'nuevo@example.invalid',password:'Secreto123',role:'AUDITOR'});await screen.findByText(created.email);expect(invalidate).toHaveBeenCalledWith({queryKey:['auth','users']});expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('');expect(screen.queryByText('Secreto123')).toBeNull();
});
it.each([[409,'El correo electrónico ya está registrado.'],[403,'No tiene permiso para crear usuarios.']])('muestra error HTTP %s sin refrescar ni anunciar éxito',async(status,message)=>{
 vi.mocked(apiClient.post).mockRejectedValue({response:{status,data:{message:'rechazado'}}});const invalidate=vi.spyOn(q,'invalidateQueries');mount();await fill();fireEvent.click(screen.getByRole('button',{name:'Crear usuario'}));expect((await screen.findByRole('alert')).textContent).toBe(message);expect(screen.queryByText('Usuario creado.')).toBeNull();expect(invalidate).not.toHaveBeenCalled();
});
it('muestra validaciones del servidor y permite corregir el formulario',async()=>{
 vi.mocked(apiClient.post).mockRejectedValue({response:{status:400,data:{message:'Nombre inválido'}}});mount();await fill();fireEvent.click(screen.getByRole('button',{name:'Crear usuario'}));expect((await screen.findByRole('alert')).textContent).toContain('Nombre inválido');expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Nuevo usuario');
});
it('otros roles no tienen formulario de alta ni pueden enviar el POST',async()=>{
 useAuthStore.setState({user:{id:'audit',email:'audit@example.invalid',role:'AUDITOR'}});mount();await waitFor(()=>expect(apiClient.get).toHaveBeenCalled());expect(screen.queryByRole('button',{name:'Crear usuario'})).toBeNull();expect(apiClient.post).not.toHaveBeenCalled();
});
it('evita otro envío mientras el alta está pendiente',async()=>{
 vi.mocked(apiClient.post).mockReturnValue(new Promise(()=>{}));mount();await fill();const button=screen.getByRole('button',{name:'Crear usuario'});fireEvent.click(button);await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(true));fireEvent.click(button);expect(apiClient.post).toHaveBeenCalledTimes(1);
});
