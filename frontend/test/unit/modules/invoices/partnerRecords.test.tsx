import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartnerDetailDrawer } from '@/modules/customs/components/PartnerDetailDrawer';
import { apiClient } from '@/lib/axios';
import { errorRegistroTercero } from '@/modules/customs/lib/partnerRecordValidation';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(),put:vi.fn(),delete:vi.fn(),post:vi.fn()}}));
const row={id:'p',legal_name:'Empresa',roles:['CLIENTE'],is_active:true,addresses:[{id:'a',label:'PRINCIPAL',address:'Av. Original',city:'Lima'}],contacts:[{id:'c',name:'Persona',email:'persona@example.com',phone:'999111222'}],bank_accounts:[{id:'b',bank_name:'BCP',account_number:'123456789',currency_code:'USD',bank_country:'PE'}]};
let q: QueryClient;
beforeEach(()=>{vi.resetAllMocks();vi.spyOn(window,'confirm').mockReturnValue(true);apiClient.get=vi.fn(async()=>({data:row})) as typeof apiClient.get;vi.mocked(apiClient.put).mockResolvedValue({data:{}});vi.mocked(apiClient.delete).mockResolvedValue({data:{}});q=new QueryClient({defaultOptions:{queries:{retry:false}}});});
afterEach(()=>{cleanup();q.clear();vi.restoreAllMocks();});
it.each([
 ['Direcciones','dirección','addresses','a','Dirección','Av. Corregida'],
 ['Contactos','contacto','contacts','c','Teléfono','+51 987654321'],
 ['Bancos','cuenta','bank-accounts','b','Número de cuenta','987654321'],
])('edita y elimina en %s con refresco',async(tab,label,kind,id,field,value)=>{
 const invalidate=vi.spyOn(q,'invalidateQueries');render(<QueryClientProvider client={q}><PartnerDetailDrawer partnerId="p" onClose={vi.fn()}/></QueryClientProvider>);
 fireEvent.click(await screen.findByRole('button',{name:tab}));fireEvent.click(screen.getByRole('button',{name:`Editar ${label}`}));
 fireEvent.change(screen.getByPlaceholderText(field),{target:{value}});fireEvent.click(screen.getByRole('button',{name:`Guardar ${label}`}));
 await waitFor(()=>expect(apiClient.put).toHaveBeenCalledWith(`/master-data/partners/p/${kind}/${id}`,expect.any(Object)));
 expect(invalidate).toHaveBeenCalledWith({queryKey:['master-data','partners']});
 fireEvent.click(screen.getByRole('button',{name:`Eliminar ${label}`}));await waitFor(()=>expect(apiClient.delete).toHaveBeenCalledWith(`/master-data/partners/p/${kind}/${id}`));
});
it('rechaza teléfono largo, correo inválido y CCI no numérico; acepta celular internacional',()=>{
 expect(errorRegistroTercero('contacts',{name:'Persona',email:'',phone:'922222222222222'})).toContain('9 dígitos');
 expect(errorRegistroTercero('contacts',{name:'Persona',email:'no-email',phone:''})).toContain('email');
 expect(errorRegistroTercero('contacts',{name:'Persona',email:'persona@example.com',phone:'+51 999 111 222'})).toBeUndefined();
 expect(errorRegistroTercero('bank-accounts',{bankName:'BCP',accountNumber:'ABC',cci:'',bankCountry:'PE'})).toContain('solo dígitos');
 expect(errorRegistroTercero('bank-accounts',{bankName:'BCP',accountNumber:'123',cci:'ABC',bankCountry:'PE'})).toContain('20 dígitos');
});
