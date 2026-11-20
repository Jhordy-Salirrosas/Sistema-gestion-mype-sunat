import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceList } from '@/modules/invoices/InvoiceList';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { descargarDesdeBackend } from '@/modules/invoices/lib/invoiceDescarga';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { useAuthStore } from '@/stores/authStore';
import type { Invoice } from '@/modules/invoices/types/invoice.types';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async () => ({ data: { series: [] } })) } }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { getInvoices: vi.fn(), getInvoiceById: vi.fn(), retryCdr: vi.fn() } }));
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({ obtenerXmlDesdeBackend: vi.fn(async () => '<Invoice/>'), extraerDigestValue: vi.fn(() => null), descargarDesdeBackend: vi.fn(async () => {}) }));
let factura: Invoice;
const queries: QueryClient[] = [];
beforeEach(() => {
 vi.clearAllMocks();sessionStorage.clear();
 useAuthStore.setState({user:{id:'admin',email:'admin@example.invalid',role:'ADMIN'},activeCompany:{tenantId:'company',ruc:'20100070970',razonSocial:'Empresa'}});
 factura=aInvoice({id:'invoice',tipo_comprobante:'01',serie:'F001',correlativo:97,numero:'F001-00000097',fecha_emision:'2026-11-20',estado:'ACEPTADO',monto_total:118,base_imponible:100,total_igv:18,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:'Cliente de prueba',cdr_codigo:'0'});
 vi.mocked(invoicesApi.getInvoices).mockImplementation(async()=>({data:[factura],total:1,page:1,pageSize:100,totalPages:1}));
 vi.mocked(invoicesApi.getInvoiceById).mockImplementation(async()=>({...factura,tieneCdr:factura.estadoBackend==='ACEPTADO',historial:[]}));
 vi.mocked(invoicesApi.retryCdr).mockResolvedValue({id:'invoice',estado:'ERROR_RED',encolado:false,mensaje:'Reintento consultado.'});
});
afterEach(()=>{cleanup();queries.splice(0).forEach(q=>q.clear());useAuthStore.getState().logout();sessionStorage.clear();});
async function mount(path = '/invoices/facturas'){
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});queries.push(q);
 render(<QueryClientProvider client={q}><MemoryRouter initialEntries={[path]}><InvoiceList/></MemoryRouter></QueryClientProvider>);
 return (await screen.findByText(factura.numero)).closest('tr')!;
}
it('la tabla termina en Estado CDR, sin columna ni controles de acciones',async()=>{
 const row=await mount();const table=row.closest('table')!;
 const headers=within(table).getAllByRole('columnheader');expect(headers).toHaveLength(9);expect(headers.at(-1)).toHaveTextContent('Estado CDR');
 expect(within(table).queryByRole('columnheader',{name:'Acciones'})).toBeNull();expect(within(row).getAllByRole('cell')).toHaveLength(9);
 expect(within(row).queryByRole('button')).toBeNull();expect(within(row).queryByText('Más acciones')).toBeNull();expect(within(row).queryByText('Ver XML')).toBeNull();expect(within(row).queryByText('Ver CDR')).toBeNull();expect(within(row).queryByText('Descargar PDF')).toBeNull();
});
it.each(['número','cliente','importe','estado'])('clic en %s abre el mismo detalle modal con pestañas y capacidades',async campo=>{
 const row=await mount();const user=userEvent.setup();
 const target=campo==='número'?within(row).getByText('F001-00000097'):campo==='cliente'?within(row).getByText('Cliente de prueba'):campo==='importe'?within(row).getByText(/118\.00/):within(row).getByLabelText('Aceptada');
 await user.click(target);const modal=await screen.findByRole('dialog',{name:/F001-00000097/});
 expect(modal).toHaveTextContent('Cliente de prueba');expect(within(modal).getByLabelText('Aceptada')).toBeVisible();
 expect(within(modal).getByRole('tab',{name:'Auditoría CDR'})).toBeVisible();expect(within(modal).getByRole('tab',{name:'Visor XML UBL 2.1'})).toBeVisible();
 expect(await within(modal).findByRole('button',{name:'Reprocesar puente'})).toBeVisible();
 expect(within(modal).getByRole('button',{name:'Descargar XML Oficial'})).toBeVisible();expect(within(modal).getByRole('button',{name:'Descargar PDF Homologado'})).toBeVisible();
 await waitFor(()=>expect(within(modal).getByRole('button',{name:'Descargar CDR'})).toBeEnabled());expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeTruthy();
 expect(screen.queryByRole('region',{name:/F001-00000097/})).toBeNull();
});
it.each(['Cerrar','Escape','fondo'])('el modal se cierra con %s y devuelve el foco a la fila',async modo=>{
 const row=await mount();const user=userEvent.setup();row.focus();await user.keyboard('{Enter}');
 const modal=await screen.findByRole('dialog',{name:/F001-00000097/});
 if(modo==='Cerrar')await user.click(within(modal).getByRole('button',{name:'Cerrar'}));
 else if(modo==='Escape')await user.keyboard('{Escape}');
 else await user.click(document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!);
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(row).toHaveFocus());
});
it('las tres descargas se mantienen dentro del detalle usando el flujo existente',async()=>{
 const row=await mount();const user=userEvent.setup();await user.click(row);const modal=await screen.findByRole('dialog');
 for(const [label,formato] of [['Descargar XML Oficial','xml'],['Descargar PDF Homologado','pdf'],['Descargar CDR','cdr']] as const){
  const button=within(modal).getByRole('button',{name:label});await waitFor(()=>expect(button).toBeEnabled());await user.click(button);await waitFor(()=>expect(descargarDesdeBackend).toHaveBeenCalledWith('invoice',formato));
 }
 expect(descargarDesdeBackend).toHaveBeenCalledTimes(3);
});
it.each([true,false])('el reintento trasladado al modal conserva la guarda de transporte: %s',async acreditado=>{
 factura={...factura,estadoBackend:'ERROR_RED',cdrStatus:'SIN_CONFIRMAR',cdrCodigo:undefined,transporteAcreditado:acreditado};
 const row=await mount();const user=userEvent.setup();await user.click(row);const modal=await screen.findByRole('dialog');
 if(acreditado){const retry=await within(modal).findByRole('button',{name:'Reintentar CDR'});await waitFor(()=>expect(retry).toBeEnabled());await user.click(retry);await waitFor(()=>expect(invoicesApi.retryCdr).toHaveBeenCalledWith('invoice'));}
 else expect(within(modal).queryByRole('button',{name:'Reintentar CDR'})).toBeNull();
});

it('Notas conserva su columna de acciones y su presentación lateral',async()=>{
 factura={...factura,tipoComprobante:'07',serie:'FC01',numero:'FC01-00000097'};
 const row=await mount('/invoices/notas');const table=row.closest('table')!;
 expect(within(table).getAllByRole('columnheader').at(-1)).toHaveTextContent('Acciones');
 const user=userEvent.setup();await user.click(within(row).getByRole('button',{name:'Ver'}));
 expect(await screen.findByRole('region',{name:/FC01-00000097/})).toBeVisible();expect(screen.queryByRole('dialog')).toBeNull();
});
