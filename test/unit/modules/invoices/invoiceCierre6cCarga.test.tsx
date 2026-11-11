import { it,expect,vi,afterEach,beforeEach } from 'vitest';
import { render,screen,cleanup } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/modules/invoices/pages/InvoicesDashboardPage';
import Emision from '@/modules/invoices/pages/InvoiceEmissionPage';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { InvoiceAggregateMonitor } from '@/modules/invoices/components/InvoiceAggregateMonitor';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[])}));
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{getMetrics:vi.fn(),getAlertas:vi.fn(),getAgregados:vi.fn(),buscarClientes:vi.fn(async()=>[])}}));
const clients:QueryClient[]=[];
function montar(ui:React.ReactNode){const c=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(c);return render(<QueryClientProvider client={c}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{vi.mocked(invoicesApi.getAlertas).mockResolvedValue({gravedadGlobal:'OK',dlq:{pendientes:0},certificado:{gravedad:'OK'}} as never);});
afterEach(()=>{cleanup();clients.splice(0).forEach(c=>c.clear());vi.resetAllMocks();});
it('panel pendiente no publica ceros ni ausencia de rechazos; cero real sí',async()=>{
 let resolver!:(v:never)=>void;vi.mocked(invoicesApi.getMetrics).mockReturnValue(new Promise(r=>{resolver=r;}));montar(<Dashboard/>);
 expect(screen.queryByText('S/ 0.00')).toBeNull();expect(screen.queryByText('Sin rechazos')).toBeNull();expect(screen.getAllByText('Cargando…').length).toBeGreaterThan(0);
 resolver({facturado:0,total:0,aceptados:0,pendientes:0,rechazados:0,tasaAceptacion:0} as never);expect(await screen.findByText('S/ 0.00')).toBeTruthy();
});
it('panel fallido informa ausencia, no cero',async()=>{vi.mocked(invoicesApi.getMetrics).mockRejectedValue(new Error('red'));montar(<Dashboard/>);await screen.findByRole('alert');expect(screen.queryByText('S/ 0.00')).toBeNull();});
it('agregados distingue carga de respuesta vacía',async()=>{let resolver!:(v:never)=>void;vi.mocked(invoicesApi.getAgregados).mockReturnValue(new Promise(r=>{resolver=r;}));montar(<InvoiceAggregateMonitor/>);expect(screen.queryByText('No hay agregados registrados.')).toBeNull();await screen.findByText('Cargando agregados…');resolver([] as never);expect(await screen.findByText('No hay agregados registrados.')).toBeTruthy();});
it('agregados fallidos no afirman vacío',async()=>{vi.mocked(invoicesApi.getAgregados).mockRejectedValue(new Error('red'));montar(<InvoiceAggregateMonitor/>);await screen.findByRole('alert');expect(screen.queryByText('No hay agregados registrados.')).toBeNull();});
it('emisión distingue primera carga y configuración vacía',async()=>{let resolver!:(v:never)=>void;vi.mocked(apiClient.get).mockReturnValue(new Promise(r=>{resolver=r;}));montar(<Emision/>);expect(screen.queryByText('Sin serie activa')).toBeNull();expect(screen.queryByText(/Siguiente: no disponible/)).toBeNull();resolver({data:{series:[]}} as never);expect(await screen.findByText('Sin serie activa')).toBeTruthy();});
it('emisión fallida no afirma que no hay serie',async()=>{vi.mocked(apiClient.get).mockRejectedValue(new Error('red'));montar(<Emision/>);expect(await screen.findByText('No se pudo cargar la configuración')).toBeTruthy();expect(screen.queryByText('Sin serie activa')).toBeNull();});
it('modal recibe estado de carga en lugar de número inventado',()=>{vi.mocked(apiClient.get).mockResolvedValue({data:[]});montar(<InvoiceEmitModal configuracionCargando tipoInicial="07" fecha="2026-11-10" existentes={[]} onCerrar={()=>{}} onEmitir={()=>{}}/>);expect(screen.queryByText(/Siguiente: no disponible/)).toBeNull();expect(screen.getByText('Cargando configuración de serie y numeración…')).toBeTruthy();});
