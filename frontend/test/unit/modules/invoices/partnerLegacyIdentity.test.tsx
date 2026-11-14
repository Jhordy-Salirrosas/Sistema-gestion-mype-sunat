import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartnerFormDialog } from '@/modules/customs/components/PartnerFormDialog';
import { errorDatosTercero } from '@/modules/customs/libPartnerValidation';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:[]})),put:vi.fn(async()=>({data:{id:'p'}})),post:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const form={docType:'6',docNumber:'204813697',legalName:'Empresa Demo',tradeName:'',countryCode:'PE',email:''};
it('exime solo la identidad histórica exacta y conserva las reglas para alta o cambios',()=>{
 expect(errorDatosTercero(form,true,{docType:'6',docNumber:'204813697'})).toBeUndefined();
 expect(errorDatosTercero(form,false)).toContain('Documento inválido');
 expect(errorDatosTercero(form,true,{docType:'6',docNumber:'otro'})).toContain('Documento inválido');
 expect(errorDatosTercero({...form,legalName:''},true,{docType:'6',docNumber:'204813697'})).toContain('razón social');
});
it('permite guardar otros datos sin enviar el documento guardado al PUT',async()=>{
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={q}><PartnerFormDialog partner={{id:'p',doc_type:'6',doc_number:form.docNumber,legal_name:form.legalName,country_code:'PE',roles:['CLIENTE'],is_active:true} as never} onClose={vi.fn()}/></QueryClientProvider>);
 expect(screen.getByLabelText('Número')).toBeDisabled();fireEvent.change(screen.getByLabelText('Razón social'),{target:{value:'Empresa Demo editada'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await waitFor(()=>expect(apiClient.put).toHaveBeenCalledWith('/master-data/partners/p',expect.objectContaining({legalName:'Empresa Demo editada'})));
 const payload=vi.mocked(apiClient.put).mock.calls.find(call=>call[0]==='/master-data/partners/p')![1] as object;expect(payload).not.toHaveProperty('docNumber');expect(payload).not.toHaveProperty('docType');q.clear();
});
