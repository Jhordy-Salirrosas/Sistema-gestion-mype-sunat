import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {InvoiceEmitModal} from '@/modules/invoices/components/InvoiceEmitModal';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import {apiClient} from '@/lib/axios';
import {invoicesApi} from '@/modules/invoices/services/invoicesApi';
import {actualizarItem,itemVacio,validarItems} from '@/modules/invoices/lib/invoiceItems';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
vi.mock('@/modules/invoices/components/RetencionMaestro',()=>({RetencionMaestro:()=>null}));
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{emitirComprobante:vi.fn(async()=>{throw Error('Captura local')})}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[{sku:'CEM-001',descripcion:'Cemento registrado',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true}])}));
const clients:QueryClient[]=[];const serie={document_type:'01',series:'F001',is_active:true};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(apiClient.get).mockImplementation(async path=>({data:String(path).includes('config')?{series:[serie]}:[]}));});
afterEach(()=>{cleanup();clients.splice(0).forEach(c=>c.clear());});
async function montar(via:string){const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);render(<QueryClientProvider client={q}><MemoryRouter>{via==='modal'?<InvoiceEmitModal tipoInicial="01" fecha="2026-11-12" existentes={[]} seriesConfiguradas={[serie]} onEmitir={()=>{}} onCerrar={()=>{}}/>:<InvoiceEmissionPage/>}</MemoryRouter></QueryClientProvider>);const buscar=await screen.findByLabelText('Buscar producto');fireEvent.change(buscar,{target:{value:'CEM'}});fireEvent.click(await screen.findByRole('button',{name:/CEM-001/}));if(via==='modal')fireEvent.click(screen.getByLabelText('Eliminar la línea 1'));fireEvent.change(document.getElementById('doc-cliente')!,{target:{value:'20100070970'}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'Cliente'}});}
it.each(['modal','pagina'])('%s entrega dos bolsas con el producto registrado y no inventa SKU',async via=>{
 await montar(via);expect(document.getElementById('bolsas')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Bolsa plástica/}));
 fireEvent.change(screen.getByLabelText('ICBPER de la línea 1'),{target:{value:'2'}});
 expect(screen.queryByLabelText('Cantidad de la línea 2')).toBeNull();
 if(via==='modal')fireEvent.click(screen.getByRole('button',{name:'Emitir Factura'}));else fireEvent.submit(document.querySelector('form')!);
 await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({items:[expect.objectContaining({codigo:'CEM-001',cantidad:1,cantidadBolsas:2,icbper:1,precioUnitario:118})]}),expect.anything()));
});
it.each([-1,1.5,NaN,Infinity])('rechaza bolsas inválidas %s sin truncarlas',cantidadBolsas=>{
 const items=actualizarItem([{...itemVacio('1'),codigo:'CEM-001',descripcion:'Cemento',valorUnitario:100}],0,{cantidadBolsas});
 expect(validarItems(items).flatMap(e=>e.motivos).join()).toContain('entera y no negativa');
});
it('detecta impuestos que no coinciden, conserva cero y no confunde cantidad de productos con bolsas',()=>{
 const item={...itemVacio('1'),codigo:'CEM-001',descripcion:'Cemento',valorUnitario:100};
 expect(validarItems([{...item,cantidadBolsas:2,icbper:0.5}]).flatMap(e=>e.motivos).join()).toContain('no coincide');
 const actual=actualizarItem([item],0,{cantidadBolsas:2});
 expect(actualizarItem(actual,0,{cantidad:7})[0]).toMatchObject({cantidad:7,cantidadBolsas:2,icbper:1});
 expect(actualizarItem(actual,0,{cantidadBolsas:0})[0]).toMatchObject({cantidadBolsas:0,icbper:0});
});
