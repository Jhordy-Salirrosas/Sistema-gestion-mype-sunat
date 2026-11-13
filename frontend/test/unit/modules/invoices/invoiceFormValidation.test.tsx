import { beforeEach as billingBeforeEach } from 'vitest';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {InvoiceEmitModal} from '@/modules/invoices/components/InvoiceEmitModal';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import {apiClient} from '@/lib/axios';
import {invoicesApi} from '@/modules/invoices/services/invoicesApi';
import {problemasContenidoEmision} from '@/modules/invoices/lib/invoiceEmissionValidation';
import {itemVacio} from '@/modules/invoices/lib/invoiceItems';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
vi.mock('@/modules/invoices/components/RetencionMaestro',()=>({RetencionMaestro:()=>null}));
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{emitirComprobante:vi.fn(async()=>{throw Error('Captura local')})}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[{sku:'SERV',descripcion:'Servicio',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true}])}));
const clients:QueryClient[]=[];const serie={document_type:'01',series:'F001',is_active:true};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(apiClient.get).mockImplementation(async path=>({data:String(path).includes('config')?{series:[serie]}:[]}));});
afterEach(()=>{cleanup();clients.splice(0).forEach(c=>c.clear());});
async function form(via:string){const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);render(<QueryClientProvider client={q}><MemoryRouter>{via==='modal'?<InvoiceEmitModal tipoInicial="01" fecha="2026-11-12" existentes={[]} seriesConfiguradas={[serie]} onEmitir={()=>{}} onCerrar={()=>{}}/>:<InvoiceEmissionPage/>}</MemoryRouter></QueryClientProvider>);await screen.findByLabelText('Buscar producto');fireEvent.change(document.getElementById('doc-cliente')!,{target:{value:'20100070970'}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'Cliente'}});fireEvent.change(screen.getByLabelText('Código de la línea 1'),{target:{value:'SERV'}});fireEvent.change(screen.getByLabelText('Descripción de la línea 1'),{target:{value:'Servicio'}});fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'),{target:{value:'100'}});}
const bad=[['nombre','',/razón social/],['nombre','A'.repeat(1501),/1500/],['descripcion','A'.repeat(501),/500/],['cantidad','1.2345',/3 decimales/],['valor','0',/onerosa/]] as const;
it.each(['modal','pagina'])('%s bloquea las mismas entradas antes del POST',async via=>{
 for(const [field,value,message] of bad){await form(via);const labels={nombre:'Razón social / nombre',descripcion:'Descripción de la línea 1',cantidad:'Cantidad de la línea 1',valor:'Valor unitario de la línea 1'};fireEvent.change(screen.getByLabelText(labels[field]),{target:{value}});if(via==='modal'){fireEvent.click(screen.getByRole('button',{name:/^Emitir /}));}else{fireEvent.submit(document.querySelector('form')!);}expect(screen.queryAllByText(message).length).toBeGreaterThan(0);expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();cleanup();}
});
it.each(['modal','pagina'])('%s admite cantidad legítima de tres decimales',async via=>{await form(via);const input=screen.getByLabelText('Cantidad de la línea 1') as HTMLInputElement;fireEvent.change(input,{target:{value:'1.234'}});expect(input.step).toBe('0.001');expect(input.validity.stepMismatch).toBe(false);if(via==='modal')fireEvent.click(screen.getByRole('button',{name:/^Emitir /}));else fireEvent.submit(document.querySelector('form')!);await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({items:expect.arrayContaining([expect.objectContaining({cantidad:1.234})])}),expect.anything()));});
it('descuento que deja onerosa en cero bloqueado; gratuita íntegra conserva la excepción',()=>{const line={...itemVacio('1'),descripcion:'Servicio',valorUnitario:100,precioUnitario:118};expect(problemasContenidoEmision({tipo:'01',clienteRazonSocial:'Cliente',items:[line],descuentoGlobal:{codigo:'02',monto:100}})).toContain('El total cero solo se admite en documentos íntegramente gratuitos con referencias positivas.');const free={...line,afectacion:'GRATUITA' as const,codigoAfectacion:'11',precioUnitario:0};expect(problemasContenidoEmision({tipo:'01',clienteRazonSocial:'Cliente',items:[free]})).toEqual([]);expect(problemasContenidoEmision({tipo:'03',clienteRazonSocial:'Cliente',items:[free]})).toEqual([]);});
it.each(['07','08'])('nota %s conserva referencia gratuita y valores históricos sin reinterpretarlos como venta nueva',tipo=>{const line={...itemVacio('1'),descripcion:'Histórico',valorUnitario:0,precioUnitario:118};expect(problemasContenidoEmision({tipo,clienteRazonSocial:'Cliente',items:[line]})).toEqual([]);expect(problemasContenidoEmision({tipo,clienteRazonSocial:'Cliente',items:[{...line,precioUnitario:0}]}).join()).toContain('onerosa');});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
