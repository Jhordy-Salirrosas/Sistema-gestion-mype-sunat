import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import {InvoiceEmitModal} from '@/modules/invoices/components/InvoiceEmitModal';
import {useAuthStore} from '@/stores/authStore';
const fixture=vi.hoisted(()=>({mode:'listo' as 'listo'|'cargando'|'error'|'vacio'}));
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async(url:string)=>{
 if(url.includes('/invoices/products')) {
  if(fixture.mode==='cargando')return new Promise(()=>{});
  if(fixture.mode==='error')throw new Error('Catálogo no disponible');
  return {data:{balances:fixture.mode==='vacio'?[]:[{sku:'CEM-001',description:'Cemento prueba',sunatUnitCode:'NIU',taxAffectation:'10',currentStock:20,salePrice:118,vendible:true,activo:true}]}};
 }
 return {data:url.includes('/invoices/config')?{series:[{document_type:'01',series:'F001',is_active:true},{document_type:'03',series:'B001',is_active:true}]}:[]};
})}}));
vi.mock('@/modules/invoices/components/RetencionMaestro',()=>({RetencionMaestro:()=>null}));
const clients:QueryClient[]=[];
beforeEach(()=>{fixture.mode='listo';useAuthStore.setState({user:{id:'local',email:'local@example.invalid',role:'ADMIN'}});});
afterEach(()=>{cleanup();clients.splice(0).forEach(c=>c.clear());});
function mount(via='pagina',tipo='01') {
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);
 render(<QueryClientProvider client={q}><MemoryRouter initialEntries={[`/invoices/emision?tipo=${tipo}`]}>{via==='modal'?<InvoiceEmitModal tipoInicial="01" fecha="2026-11-13" seriesConfiguradas={[{document_type:'01',series:'F001',is_active:true}]} existentes={[]} onEmitir={vi.fn()} onCerrar={vi.fn()}/>:<Routes><Route path="/invoices/emision" element={<InvoiceEmissionPage/>}/></Routes>}</MemoryRouter></QueryClientProvider>);
}
it.each(['01','03'])('ruta %s: solo la selección del catálogo crea una línea',async tipo=>{
 mount('pagina',tipo);const user=userEvent.setup();const search=await screen.findByRole('combobox',{name:'Buscar producto'});
 expect(screen.queryByLabelText('Código de la línea 1')).toBeNull();
 expect(screen.queryByRole('button',{name:/Añadir ítem/})).toBeNull();
 for(let n=0;n<3;n++){await user.click(search);await user.keyboard('{Alt>}l{/Alt}');expect(document.activeElement).toBe(search);expect(screen.queryByLabelText('Descripción de la línea 1')).toBeNull();}
 await user.keyboard('CEM');await user.click(screen.getByRole('button',{name:/CEM-001 · Cemento prueba/}));
 const code=screen.getByLabelText('Código de la línea 1') as HTMLInputElement;
 expect(code.readOnly).toBe(true);expect(code.value).toBe('CEM-001');
 await user.click(search);await user.keyboard('{Alt>}l{/Alt}');expect(screen.queryByLabelText('Descripción de la línea 2')).toBeNull();
 await user.click(screen.getByRole('button',{name:'Eliminar la línea 1'}));expect(screen.queryByLabelText('Código de la línea 1')).toBeNull();
});
it.each(['pagina','modal'])('%s: Alt+L solo enfoca búsqueda con líneas seleccionadas',async via=>{
 mount(via);const user=userEvent.setup();const search=await screen.findByRole('combobox',{name:'Buscar producto'});
 await user.click(search);await user.keyboard('{Alt>}l{/Alt}');expect(document.activeElement).toBe(search);expect(screen.queryByLabelText('Descripción de la línea 1')).toBeNull();
 await user.keyboard('CEM');await user.click(screen.getByRole('button',{name:/CEM-001 · Cemento prueba/}));
 await user.click(search);await user.keyboard('{Alt>}l{/Alt}');await user.keyboard('{Alt>}l{/Alt}');
 expect(screen.queryByLabelText('Descripción de la línea 2')).toBeNull();
 await user.keyboard('CEM');await user.click(screen.getByRole('button',{name:/CEM-001 · Cemento prueba/}));
 await user.click(screen.getByRole('button',{name:'Mantener separada'}));
 expect((screen.getByLabelText('Código de la línea 2') as HTMLInputElement).value).toBe('CEM-001');
});
it.each(['cargando','error','vacio'] as const)('catálogo %s tiene explicación visible y recibe el foco al añadir',async mode=>{
 fixture.mode=mode;mount();const user=userEvent.setup();
 const message=mode==='cargando'?/Cargando productos del almacén/:mode==='error'?/No se pudo cargar el catálogo del almacén/:/No hay productos disponibles en el almacén/;
 const status=await screen.findByText(message);
 expect(screen.queryByRole('combobox',{name:'Buscar producto'})).toBeNull();
 status.focus();await user.keyboard('{Alt>}l{/Alt}');expect(document.activeElement).toBe(status);
 expect(screen.queryByLabelText('Descripción de la línea 2')).toBeNull();
 await waitFor(()=>expect(status.textContent).toMatch(message));
});
it.each(['pagina','modal'])('%s: elegir otra línea cuando no hay fila vacía añade sin reemplazar la anterior',async via=>{
 mount(via);const user=userEvent.setup();const search=await screen.findByRole('combobox',{name:'Buscar producto'});
 await user.type(search,'CEM');await user.click(screen.getByRole('button',{name:/CEM-001 · Cemento prueba/}));
 await user.type(search,'CEM');await user.click(screen.getByRole('button',{name:/CEM-001 · Cemento prueba/}));
 await user.click(screen.getByRole('button',{name:'Mantener separada'}));
 expect((screen.getByLabelText('Código de la línea 1') as HTMLInputElement).value).toBe('CEM-001');
 expect((screen.getByLabelText('Código de la línea 2') as HTMLInputElement).value).toBe('CEM-001');
 expect(screen.queryByLabelText('Descripción de la línea 3')).toBeNull();
});
