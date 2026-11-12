import { beforeEach as billingBeforeEach } from 'vitest';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import {InvoiceEmitModal} from '@/modules/invoices/components/InvoiceEmitModal';
import {invoicesApi} from '@/modules/invoices/services/invoicesApi';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async()=>({data:{series:[{document_type:'01',series:'F001',is_active:true}]}}))}}));
vi.mock('@/modules/invoices/components/RetencionMaestro',()=>({RetencionMaestro:()=>null}));
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{emitirComprobante:vi.fn(async()=>{throw Error('Captura local')})}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[{sku:'CEM',descripcion:'Cemento',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true}])}));
const clients:QueryClient[]=[];
afterEach(()=>{cleanup();clients.splice(0).forEach(c=>c.clear());vi.clearAllMocks();});
async function montar(modal=false){const qc=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(qc);render(<MemoryRouter><QueryClientProvider client={qc}>{modal?<InvoiceEmitModal tipoInicial="01" fecha="2026-11-12" existentes={[]} seriesConfiguradas={[{document_type:'01',series:'F001',is_active:true}]} onEmitir={vi.fn()} onCerrar={vi.fn()}/>:<InvoiceEmissionPage/>}</QueryClientProvider></MemoryRouter>);await screen.findByLabelText('Buscar producto');}
it('Alt+C/P/L funciona desde body y por code, sin duplicarse dentro del formulario',async()=>{
 await montar();
 fireEvent.keyDown(document.body,{altKey:true,key:'ç',code:'KeyC'});expect(document.activeElement).toBe(document.getElementById('doc-cliente'));
 fireEvent.keyDown(document.body,{altKey:true,key:'π',code:'KeyP'});expect(document.activeElement).toBe(screen.getByLabelText('Buscar producto'));
 fireEvent.keyDown(document.body,{altKey:true,key:'¬',code:'KeyL'});expect(screen.getAllByLabelText(/Descripción de la línea/)).toHaveLength(2);
 fireEvent.keyDown(screen.getByLabelText('Descripción de la línea 1'),{altKey:true,key:'l',code:'KeyL'});expect(screen.getAllByLabelText(/Descripción de la línea/)).toHaveLength(3);
});
it('Ctrl+Enter fuera del form abre revisión y confirmar ejecuta las validaciones y un solo POST',async()=>{
 await montar();fireEvent.change(document.getElementById('doc-cliente')!,{target:{value:'20100070970'}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'Cliente'}});fireEvent.change(screen.getByLabelText('Código de la línea 1'),{target:{value:'CEM'}});fireEvent.change(screen.getByLabelText('Descripción de la línea 1'),{target:{value:'Cemento'}});fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'),{target:{value:'100'}});
 fireEvent.keyDown(document.body,{ctrlKey:true,key:'Enter',code:'Enter'});expect(screen.getByRole('dialog')).toBeTruthy();expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirmar emisión revisada'}));await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(1));
});
it('no captura los atajos de otro diálogo y elimina el listener al desmontar',async()=>{
 await montar();const dialog=document.createElement('div');dialog.setAttribute('role','dialog');document.body.append(dialog);
 fireEvent.keyDown(document.body,{altKey:true,key:'l',code:'KeyL'});fireEvent.keyDown(dialog,{ctrlKey:true,key:'Enter'});expect(screen.getAllByLabelText(/Descripción de la línea/)).toHaveLength(1);expect(screen.queryByRole('button',{name:'Confirmar emisión revisada'})).toBeNull();dialog.remove();
 cleanup();fireEvent.keyDown(document.body,{altKey:true,key:'l',code:'KeyL'});expect(screen.queryByLabelText('Descripción de la línea 1')).toBeNull();
});
it('conserva alcance del modal y reconoce Option por code',async()=>{
 await montar(true);fireEvent.keyDown(screen.getByLabelText('Buscar producto'),{altKey:true,key:'¬',code:'KeyL'});expect(screen.getAllByLabelText(/Descripción de la línea/)).toHaveLength(2);
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
