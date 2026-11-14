import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartnerDetailDrawer } from '@/modules/customs/components/PartnerDetailDrawer';
const api=vi.hoisted(()=>({getPartner:vi.fn(),updatePartner:vi.fn()}));
vi.mock('@/modules/customs/services/masterDataApi',()=>({masterDataApi:api}));
const row={id:'p',legal_name:'Empresa',doc_type:'6',doc_number:'20100070970',roles:['CLIENTE'],is_active:false,addresses:[],contacts:[],bank_accounts:[]};
let q: QueryClient;
beforeEach(()=>{vi.resetAllMocks();api.getPartner.mockResolvedValue(row);api.updatePartner.mockImplementation(async (_id,payload)=>{api.getPartner.mockResolvedValue({...row,is_active:payload.isActive});return{};});q=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});});
afterEach(()=>{cleanup();q.clear();});
function mount(readOnly=false){render(<QueryClientProvider client={q}><PartnerDetailDrawer partnerId="p" onClose={vi.fn()} readOnly={readOnly}/></QueryClientProvider>);}
it('reactiva e inactiva y refresca la ficha y lista',async()=>{
 const invalidate=vi.spyOn(q,'invalidateQueries');mount();fireEvent.click(await screen.findByRole('button',{name:'Activar tercero'}));
 await screen.findByRole('button',{name:'Inactivar tercero'});expect(api.updatePartner).toHaveBeenLastCalledWith('p',{isActive:true});
 expect(invalidate).toHaveBeenCalledWith({queryKey:['master-data','partners']});
 fireEvent.click(screen.getByRole('button',{name:'Inactivar tercero'}));await screen.findByRole('button',{name:'Activar tercero'});expect(api.updatePartner).toHaveBeenLastCalledWith('p',{isActive:false});
});
it('respeta solo lectura',async()=>{mount(true);await screen.findByText('Empresa');expect(screen.queryByRole('button',{name:'Activar tercero'})).toBeNull();});
it('muestra error del servidor y conserva el estado',async()=>{
 api.updatePartner.mockRejectedValue({response:{data:{message:'No se pudo cambiar el estado.'}}});mount();fireEvent.click(await screen.findByRole('button',{name:'Activar tercero'}));
 await screen.findByText('No se pudo cambiar el estado.');await waitFor(()=>expect(screen.getByRole('button',{name:'Activar tercero'})).toBeEnabled());
});
