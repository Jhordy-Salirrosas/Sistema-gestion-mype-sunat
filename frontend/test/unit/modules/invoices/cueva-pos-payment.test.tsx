import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SalesPosPage from '@/modules/sales/pages/SalesPosPage';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { masterDataApi } from '@/modules/customs/services/masterDataApi';
import { collectionsApi } from '@/modules/collections/services/collectionsApi';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{emitirComprobante:vi.fn(),buscarClientes:vi.fn(async()=>[])}}));
vi.mock('@/modules/collections/services/collectionsApi',()=>({collectionsApi:{create:vi.fn()}}));
vi.mock('@/modules/customs/services/masterDataApi',()=>({masterDataApi:{getPartners:vi.fn()}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[{sku:'SKU',descripcion:'Producto',stock:5,unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10'}])}));
vi.mock('@/modules/sales/services/salesQuotesApi',()=>({salesQuotesApi:{get:vi.fn(),status:vi.fn()}}));
let condition='Contado';let query:QueryClient;
beforeEach(()=>{vi.clearAllMocks();condition='Contado';useAuthStore.setState({user:{id:'admin',email:'admin@example.invalid',role:'ADMIN'},activeCompany:{tenantId:'company',ruc:'20100070970',razonSocial:'Empresa'}});vi.mocked(masterDataApi.getPartners).mockResolvedValue([]);vi.mocked(apiClient.get).mockImplementation(async(url)=>({data:url==='/invoices/commercial-defaults'?{forma_pago:condition,medio_pago:'YAPE'}:url==='/invoices/config'?{series:[{document_type:'01',series:'F001',is_active:true},{document_type:'03',series:'B001',is_active:true}]}:url==='/invoices/warehouses'?[{warehouse_code:'ALM-01',description:'Almacén'}]:[]}));vi.mocked(invoicesApi.emitirComprobante).mockResolvedValue({id:'invoice',numero:'B001-00000001',monto_total:118} as never);vi.mocked(collectionsApi.create).mockResolvedValue({id:'m1-cash:invoice'} as never);});
afterEach(()=>{cleanup();query?.clear();useAuthStore.getState().logout();});
function mount(){query=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});render(<QueryClientProvider client={query}><MemoryRouter><SalesPosPage/></MemoryRouter></QueryClientProvider>);}
it('POS consume el medio global y envía ese medio a emisión y al reintento compatible de cobro',async()=>{
 mount();await waitFor(()=>expect(screen.getByLabelText('Medio de pago')).toHaveValue('YAPE'));
 fireEvent.change(screen.getByLabelText('Documento del cliente'),{target:{value:'20100070970'}});fireEvent.change(screen.getByLabelText('Nombre del cliente'),{target:{value:'Cliente'}});
 fireEvent.click(await screen.findByRole('button',{name:'Agregar'}));fireEvent.click(screen.getByRole('button',{name:'Cobrar y emitir'}));
 await waitFor(()=>expect(collectionsApi.create).toHaveBeenCalledTimes(1));expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({medio_pago:'YAPE',forma_pago:'Contado'}),expect.any(String));
});
it.each([true,false])('crédito global requiere factura y permiso del cliente: %s',async allowed=>{
 condition='Credito';vi.mocked(masterDataApi.getPartners).mockResolvedValue([{id:'client',doc_type:'6',doc_number:'20100070970',roles:['CLIENTE'],is_active:true,has_credit:allowed}] as never);mount();fireEvent.change(screen.getByLabelText('Tipo de comprobante'),{target:{value:'01'}});fireEvent.change(screen.getByLabelText('Documento del cliente'),{target:{value:'20100070970'}});
 await waitFor(()=>expect(masterDataApi.getPartners).toHaveBeenCalled());await waitFor(()=>expect(screen.getByLabelText('Condición de pago')).toHaveValue(allowed?'Credito':'Contado'));
 expect((screen.getByRole('option',{name:'Crédito'}) as HTMLOptionElement).disabled).toBe(!allowed);
});
