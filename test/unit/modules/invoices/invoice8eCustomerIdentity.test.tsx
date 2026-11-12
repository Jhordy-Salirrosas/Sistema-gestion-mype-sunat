import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import {InvoiceEmitModal} from '@/modules/invoices/components/InvoiceEmitModal';
import {CustomerLookupField} from '@/modules/invoices/components/CustomerLookupField';
import {apiClient} from '@/lib/axios';
import {hoyEnLima} from '@/modules/invoices/lib/invoiceFecha';
import {seriesConfiguradasPrueba} from '../../../fixtures/invoiceSeries';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[])}));
vi.mock('@/modules/invoices/components/RetencionMaestro',()=>({RetencionMaestro:()=>null}));
const cliente={id:'A',doc_type:'6',doc_number:'20100070970',legal_name:'CLIENTE ANTERIOR',roles:['CLIENTE'],is_active:true,has_credit:true,allows_discount:true,address:'Dirección anterior'};
const clients:QueryClient[]=[];
function wrap(node:React.ReactNode){const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);return render(<QueryClientProvider client={q}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);}
function mount(via:string){wrap(via==='pagina'?<InvoiceEmissionPage/>:<InvoiceEmitModal tipoInicial="01" seriesConfiguradas={seriesConfiguradasPrueba} fecha={hoyEnLima()} existentes={[]} onEmitir={vi.fn()} onCerrar={vi.fn()}/>);return screen.getByLabelText(via==='pagina'?'RUC del cliente':'RUC / DNI del cliente') as HTMLInputElement;}
beforeEach(()=>{vi.mocked(apiClient.get).mockImplementation(async(url,config)=>{if(url==='/invoices/config')return{data:{series:seriesConfiguradasPrueba}};if(url==='/master-data/partners')return String((config?.params as { q?: string } | undefined)?.q)===cliente.doc_number?{data:[cliente]}:new Promise(()=>{});return{data:[]};});});
afterEach(()=>{cleanup();clients.splice(0).forEach(q=>q.clear());vi.resetAllMocks();});
it.each(['pagina','modal'])('%s invalida documento al editar nombre y conserva el texto durante la búsqueda',async via=>{
 const doc=mount(via);fireEvent.change(doc,{target:{value:cliente.doc_number}});await userEvent.click(await screen.findByRole('button',{name:/CLIENTE ANTERIOR/}));fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'CLIENTE NUEVO'}});
 expect(doc.value).toBe('');expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe('CLIENTE NUEVO');expect(screen.getByText('Buscando en el maestro…')).toBeTruthy();expect(screen.queryByRole('button',{name:/CLIENTE ANTERIOR/})).toBeNull();
 await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith('/master-data/partners',{params:{role:'CLIENTE',q:'CLIENTE NUEVO'}}));expect(doc.value).toBe('');
});
it.each(['pagina','modal'])('%s invalida nombre al editar documento confirmado',async via=>{const doc=mount(via);fireEvent.change(doc,{target:{value:cliente.doc_number}});await userEvent.click(await screen.findByRole('button',{name:/CLIENTE ANTERIOR/}));fireEvent.change(doc,{target:{value:'2010007097'}});expect(doc.value).toBe('2010007097');expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe('');});
it.each(['pagina','modal'])('%s conserva la entrada manual sin selección implícita',via=>{const doc=mount(via);fireEvent.change(doc,{target:{value:cliente.doc_number}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'CLIENTE MANUAL'}});expect(doc.value).toBe(cliente.doc_number);expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe('CLIENTE MANUAL');});
it('mantiene el descarte de sugerencias resueltas fuera de orden',async()=>{
 let resolveA:(v:{data:typeof cliente[]})=>void=()=>{},resolveB:(v:{data:typeof cliente[]})=>void=()=>{};
 vi.mocked(apiClient.get).mockImplementation((_url,config)=>new Promise(resolve=>{if((config?.params as { q?: string } | undefined)?.q==='111')resolveA=resolve;else resolveB=resolve;}));
 function Form(){const[d,set]=useState('');return <CustomerLookupField documento={d} razonSocial="" labelDocumento="Documento" onDocumentoChange={set} onElegir={vi.fn()}/>;}
 wrap(<Form/>);fireEvent.change(screen.getByLabelText('Documento'),{target:{value:'111'}});await waitFor(()=>expect(apiClient.get).toHaveBeenCalledTimes(1));fireEvent.change(screen.getByLabelText('Documento'),{target:{value:'222'}});await waitFor(()=>expect(apiClient.get).toHaveBeenCalledTimes(2));
 await act(async()=>resolveB({data:[{...cliente,id:'B',doc_number:'222',legal_name:'CLIENTE B'}]}));expect(await screen.findByRole('button',{name:/CLIENTE B/})).toBeTruthy();await act(async()=>resolveA({data:[{...cliente,id:'A',doc_number:'111',legal_name:'CLIENTE A'}]}));expect(screen.queryByRole('button',{name:/CLIENTE A/})).toBeNull();
});
