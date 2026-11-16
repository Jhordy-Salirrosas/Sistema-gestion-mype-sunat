import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomerLookupField } from '@/modules/invoices/components/CustomerLookupField';
import { masterDataApi } from '@/modules/customs/services/masterDataApi';
import { consultarDni, consultarRuc } from '@/modules/invoices/services/rucApi';
vi.mock('@/modules/invoices/hooks/useInvoiceWritePermission',()=>({useInvoiceWritePermission:()=>true}));
vi.mock('@/modules/customs/services/masterDataApi',()=>({masterDataApi:{getPartners:vi.fn()}}));
vi.mock('@/modules/invoices/services/rucApi',()=>({consultarDni:vi.fn(),consultarRuc:vi.fn()}));
vi.mock('@/modules/customs/components/PartnerFormDialog',()=>({PartnerFormDialog:({onSaved,onClose}:any)=><button onClick={()=>{onSaved({id:'created',doc_type:'1',doc_number:'12345678',legal_name:'Cliente creado',roles:['CLIENTE'],is_active:true});onClose();}}>Guardar cliente local</button>}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(masterDataApi.getPartners).mockResolvedValue([]);});
afterEach(cleanup);
function mount() {
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  function Form(){const [doc,setDoc]=useState('');const [name,setName]=useState('');return <><output>Detalle conservado</output><CustomerLookupField unico documento={doc} razonSocial={name} labelDocumento="Identidad" onDocumentoChange={setDoc} onRazonSocialChange={setName} onElegir={c=>{setDoc(c.numeroDocumento);setName(c.razonSocial);}}/></>;}
  render(<QueryClientProvider client={client}><Form/></QueryClientProvider>);
}
it('boleta usa un solo input y reutiliza la consulta DNI de Decolecta',async()=>{
  vi.mocked(consultarDni).mockResolvedValue({dni:'12345678',nombreCompleto:'Persona consultada'} as never);mount();
  expect(screen.getAllByRole('textbox')).toHaveLength(1);fireEvent.change(screen.getByLabelText('Identidad'),{target:{value:'12345678'}});
  expect(await screen.findByText('DNI 12345678 · Persona consultada')).toBeInTheDocument();expect(consultarDni).toHaveBeenCalledWith('12345678');
});
it('busca razón social y registra en modal sin perder el formulario, dejando seleccionado al creado',async()=>{
  mount();fireEvent.change(screen.getByLabelText('Identidad'),{target:{value:'Cliente'}});
  fireEvent.click(screen.getByRole('button',{name:'Registrar cliente nuevo'}));fireEvent.click(screen.getByRole('button',{name:'Guardar cliente local'}));
  expect(screen.getByLabelText('Identidad')).toHaveValue('12345678');expect(screen.getByText('DNI 12345678 · Cliente creado')).toBeInTheDocument();expect(screen.getByText('Detalle conservado')).toBeInTheDocument();
});

it('el mismo campo consulta RUC y presenta la identidad sin agregar otro input',async()=>{
  vi.mocked(consultarRuc).mockResolvedValue({ruc:'20100070970',razonSocial:'Empresa consultada',direccionFiscal:'Lima'} as never);mount();
  fireEvent.change(screen.getByLabelText('Identidad'),{target:{value:'20100070970'}});
  expect(await screen.findByText('RUC 20100070970 · Empresa consultada')).toBeInTheDocument();expect(screen.getAllByRole('textbox')).toHaveLength(1);expect(consultarRuc).toHaveBeenCalledWith('20100070970');
});
