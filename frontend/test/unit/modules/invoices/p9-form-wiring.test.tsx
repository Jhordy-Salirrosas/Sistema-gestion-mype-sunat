import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import {InvoiceEmitModal} from '@/modules/invoices/components/InvoiceEmitModal';
import {useAuthStore} from '@/stores/authStore';
import {apiClient} from '@/lib/axios';
import {invoicesApi} from '@/modules/invoices/services/invoicesApi';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[])}));
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{emitirComprobante:vi.fn(),getSaldoNota:vi.fn(async()=>({total:118,disponible:118,cantidades_pendientes:[]}))}}));
vi.mock('@/modules/invoices/components/RetencionMaestro',()=>({RetencionMaestro:()=>null}));
vi.mock('@/modules/invoices/components/CustomerLookupField',()=>({CustomerLookupField:({onElegir}:any)=><><button type="button" onClick={()=>onElegir({id:'r',tipoDocumento:'6',numeroDocumento:'20100070970',razonSocial:'Cliente RUC',tieneCredito:true,admiteDescuento:true})}>Cliente RUC</button><button type="button" onClick={()=>onElegir({id:'d',tipoDocumento:'1',numeroDocumento:'12345678',razonSocial:'Cliente DNI',tieneCredito:true,admiteDescuento:true})}>Cliente DNI</button><button type="button" onClick={()=>onElegir({id:'e',tipoDocumento:'4',numeroDocumento:'CE123',razonSocial:'Cliente CE',tieneCredito:false,admiteDescuento:false})}>Cliente CE</button></>}));
vi.mock('@/modules/invoices/components/InvoiceItemsGrid',()=>({InvoiceItemsGrid:({onCambiar}:any)=><button type="button" onClick={()=>onCambiar(0,{codigo:'P',descripcion:'Producto gratuito',cantidad:2,valorUnitario:100,precioUnitario:0,afectacion:'GRATUITA',codigoAfectacion:'11'})}>Línea gratuita</button>}));
// Simula un evento de confirmación programático: la autorización también debe existir en el handler.
vi.mock('@/modules/invoices/components/InvoiceWriteButton',()=>({InvoiceWriteButton:({disabled:_disabled,...props}:any)=><button {...props}/>}));
vi.mock('@/modules/invoices/components/InvoiceEmitCampos',()=>({InvoiceEmitCampos:({onItemDesdeProducto,borrador}:any)=><><output>{borrador.items.length} líneas del borrador</output><button type="button" onClick={()=>onItemDesdeProducto({sku:'P',descripcion:'Producto',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true})}>Producto del catálogo</button></>}));
const queries:QueryClient[]=[];
beforeEach(()=>{useAuthStore.setState({user:{id:'a',email:'test@example.invalid',role:'ADMIN'}});vi.mocked(apiClient.get).mockResolvedValue({data:{series:[{document_type:'01',series:'F001',is_active:true},{document_type:'03',series:'B001',is_active:true}]}});});
afterEach(()=>{cleanup();queries.splice(0).forEach(q=>q.clear());vi.clearAllMocks();useAuthStore.setState({user:null});});
function mount(page:React.ReactNode){const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});queries.push(q);render(<QueryClientProvider client={q}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>);}
it('Liquidación muestra referencia gratuita y descuento global y el cambio DNI fuerza Contado',async()=>{
 mount(<InvoiceEmissionPage/>);await screen.findByRole('option',{name:/F001/});
 fireEvent.click(screen.getByRole('button',{name:'Cliente RUC'}));fireEvent.click(screen.getByRole('button',{name:'Crédito'}));
 fireEvent.click(screen.getByRole('button',{name:'Línea gratuita'}));expect(screen.getByText('Op. gratuita (referencial)')).toBeTruthy();expect(screen.getByText('S/ 200.00')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Descuento global (Catálogo 53)'),{target:{value:'03'}});expect(screen.getByText('Descuento global (03)')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Cliente DNI'}));expect((screen.getByRole('button',{name:'Crédito'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Tipo de comprobante'),{target:{value:'01'}});expect((screen.getByRole('button',{name:'Crédito'}) as HTMLButtonElement).disabled).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Cliente CE'}));expect((screen.getByRole('button',{name:'Crédito'}) as HTMLButtonElement).disabled).toBe(true);
});
it('un submit programático de auditor no llama la API',async()=>{
 useAuthStore.setState({user:{id:'u',email:'test@example.invalid',role:'AUDITOR'}});mount(<InvoiceEmissionPage/>);fireEvent.submit(document.querySelector('form')!);expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
});
it('catálogo reemplaza la primera línea vacía y agrega las siguientes; auditor no confirma',()=>{
 useAuthStore.setState({user:{id:'u',email:'test@example.invalid',role:'AUDITOR'}});
 mount(<InvoiceEmitModal tipoInicial="01" fecha="2026-11-12" existentes={[]} seriesConfiguradas={[{document_type:'01',series:'F001',is_active:true}]} onEmitir={vi.fn()} onCerrar={vi.fn()}/>);
 expect(screen.getByText('1 líneas del borrador')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Producto del catálogo'}));expect(screen.getByText('1 líneas del borrador')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Producto del catálogo'}));expect(screen.getByText('2 líneas del borrador')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Emitir Factura'}));expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
});
