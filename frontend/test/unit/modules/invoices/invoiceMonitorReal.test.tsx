import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InvoiceMonitorPage from '@/modules/invoices/pages/InvoiceMonitorPage';
import { apiClient } from '@/lib/axios';
import { ALERTAS_VACIAS } from '@/modules/invoices/lib/invoiceAlertas';
import { exportarReporteSireCsv } from '@/modules/invoices/lib/invoiceExportSire';
import { useAuthStore } from '@/stores/authStore';
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(),post:vi.fn()}}));
vi.mock('@/lib/offlineCache',()=>({cachedGet:(_key:string,read:()=>unknown)=>read()}));
vi.mock('@/modules/invoices/components/InvoiceAggregateMonitor',()=>({InvoiceAggregateMonitor:()=>null}));
vi.mock('@/modules/invoices/lib/invoiceExportSire',()=>({exportarReporteSireCsv:vi.fn()}));
const raw=(id:string,estado='RECHAZADO',en_dlq=true,origen='PREPARACION_LOCAL')=>({
 id,tipo_comprobante:'01',serie:'F001',correlativo:Number(id),numero:`F001-${id.padStart(8,'0')}`,fecha_emision:'2026-11-12',estado,en_dlq,
 monto_total:118,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:`Cliente ${id}`,cdr_codigo:null,
 resultado_presentacion:{origen,codigo:'M1_PREPARATION_DATOS_INVALIDOS',motivo:'Motivo local'},base_imponible:100,total_igv:18,
});
const local=raw('5'),incierto=raw('52','ENVIADO',true,'TRANSPORTE_INCIERTO'),final=raw('80','ACEPTADO',true,'SUNAT'),libre=raw('81','ACEPTADO',false,'SUNAT');
beforeEach(()=>{
 useAuthStore.setState({user:{id:'operador',email:'test@example.invalid',role:'ADMIN'}});
 vi.mocked(apiClient.get).mockImplementation(async(url,options)=>{
  if(url==='/invoices/alertas')return {data:{...ALERTAS_VACIAS,dlq:{evaluado:true,pendientes:4,gravedad:'CRITICO',mensaje:'4 trabajos pendientes'}}} as never;
  if(url==='/invoices'){
   const f=(options?.params ?? {}) as Record<string,string|number>;
   const docs=f.en_dlq==='true' ? [local,incierto,final] : f.estado==='ENVIADO'?[incierto] : f.estado==='PENDIENTE'?[{...raw('6','PENDIENTE',false),resultado_presentacion:undefined}]:!f.estado&&!f.puente_pendiente?[libre]:[];
   return {data:{data:docs,total:docs.length,page:f.page,page_size:100,total_pages:1}} as never;
  }
  if(url==='/invoices/81')return {data:{...libre,ruc_emisor:'20100070970',lineas_origen:[{codigo:'MAT',descripcion:'Producto',cantidad:1,valor_unitario:100,afectacion:'10',icbper:0}]}} as never;
  throw new Error(`Ruta inesperada ${url}`);
 });
});
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('API sin historial: documentos únicos DLQ, estados finales, páginas y trabajos separados',async()=>{
 render(<InvoiceMonitorPage/>);
 await screen.findByText(local.numero);
 const card=within(screen.getByText('Cola de muertos (DLQ)').closest('[data-slot="card"]') as HTMLElement);
 expect(card.getByText('3')).toBeTruthy();expect(card.getByText('4 trabajos en DLQ · 3 documentos únicos')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Filtrar estado del monitor'),{target:{value:'DLQ'}});
 expect(screen.getByText('Comprobantes en vuelo (3)')).toBeTruthy();
 for(const doc of [local,incierto,final])expect(screen.getByText(doc.numero)).toBeTruthy();
 expect(screen.queryByText('F001-00000006')).toBeNull();
 expect(within(screen.getByText(final.numero).closest('tr')!).queryByRole('button',{name:'Reintentar'})).toBeNull();
 const exportar=await screen.findByRole('button',{name:'Exportar propuesta RVIE - SIRE (CSV)'});
 expect(exportar.hasAttribute('disabled')).toBe(false);fireEvent.click(exportar);
 expect(exportarReporteSireCsv).toHaveBeenCalledWith([expect.objectContaining({id:'81',estado:'ACEPTADO',baseImponible:100,igv:18})]);
});
it('cuando trabajos y documentos coinciden no muestra una aclaración redundante',async()=>{
 const original=vi.mocked(apiClient.get).getMockImplementation()!;
 vi.mocked(apiClient.get).mockImplementation(async(url,options)=> url==='/invoices/alertas'?{data:{...ALERTAS_VACIAS,dlq:{evaluado:true,pendientes:3,gravedad:'CRITICO',mensaje:'3 pendientes'}}} as never:original(url,options));
 render(<InvoiceMonitorPage/>);await screen.findByText(local.numero);
 expect(screen.queryByText(/trabajos en DLQ ·/)).toBeNull();
});
it('un fallo en la propuesta RVIE conserva el Monitor operativo y permite recargar',async()=>{
 const original=vi.mocked(apiClient.get).getMockImplementation()!;let fallo=true;
 vi.mocked(apiClient.get).mockImplementation(async(url,options)=>{
  const p=(options?.params ?? {}) as Record<string,string|number>;
  if(url==='/invoices'&&!p.estado&&!p.puente_pendiente&&!p.en_dlq&&fallo)throw new Error('Propuesta no disponible');
  return original(url,options);
 });
 render(<InvoiceMonitorPage/>);await screen.findByText('Propuesta no disponible');await screen.findByText(local.numero);
 fallo=false;fireEvent.click(screen.getByRole('button',{name:'Actualizar propuesta RVIE'}));
 await screen.findByRole('button',{name:'Exportar propuesta RVIE - SIRE (CSV)'});
 await waitFor(()=>expect(screen.queryByText('Propuesta no disponible')).toBeNull());
});

it('recorre una DLQ de 101 documentos con la paginación real de 100 filas',async()=>{
 const original=vi.mocked(apiClient.get).getMockImplementation()!;
 const docs=Array.from({length:101},(_,i)=>raw(String(i+1),'ACEPTADO',true,'SUNAT'));
 vi.mocked(apiClient.get).mockImplementation(async(url,options)=>{
  const f=(options?.params??{}) as Record<string,string|number>;
  if(url==='/invoices'&&f.en_dlq==='true')return {data:{data:f.page===1?docs.slice(0,100):docs.slice(100),total:101,page:f.page,page_size:100,total_pages:2}} as never;
  return original(url,options);
 });
 render(<InvoiceMonitorPage/>);await screen.findByText('F001-00000101');
 fireEvent.change(screen.getByLabelText('Filtrar estado del monitor'),{target:{value:'DLQ'}});
 expect(screen.getByText('Comprobantes en vuelo (101)')).toBeTruthy();
 expect(apiClient.get).toHaveBeenCalledWith('/invoices',{params:expect.objectContaining({en_dlq:'true',page:2,page_size:'100'})});
});

it('resuelve la DLQ del aceptado con CDR por acción explícita y actualiza la tarjeta sin reenviar', async () => {
  const original = vi.mocked(apiClient.get).getMockImplementation()!;
  let resuelto = false;
  vi.mocked(apiClient.get).mockImplementation(async (url, options) => {
    const response = await original(url, options) as { data: { data: ReturnType<typeof raw>[] } };
    if (url === '/invoices' && (options?.params as Record<string, string> | undefined)?.en_dlq === 'true') {
      return { data: { ...response.data, data: response.data.data.filter((row: { id: string }) => !resuelto || row.id !== final.id).map((row: { id: string }) => row.id === final.id ? { ...row, cdr_codigo: '0' } : row) } };
    }
    if (url === '/invoices/alertas' && resuelto) return { data: { ...ALERTAS_VACIAS, dlq: { evaluado: true, pendientes: 2, gravedad: 'AVISO', mensaje: '2 trabajos pendientes' } } };
    return response;
  });
  vi.mocked(apiClient.post).mockImplementation(async () => {
    resuelto = true;
    return { data: { resueltos: 2, mensaje: '2 trabajos de DLQ resueltos. El comprobante fiscal conserva su estado.' } };
  });
  render(<InvoiceMonitorPage />);
  const button = await screen.findByRole('button', { name: 'Resolver DLQ' });
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(within(screen.getByText(final.numero).closest('tr')!).queryByRole('button', { name: 'Reintentar' })).toBeNull();
  fireEvent.click(button);
  expect(await screen.findByText('2 trabajos de DLQ resueltos. El comprobante fiscal conserva su estado.')).toBeTruthy();
  await waitFor(() => expect(screen.queryByText(final.numero)).toBeNull());
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/invoices/80/resolver-dlq');
  const card = within(screen.getByText('Cola de muertos (DLQ)').closest('[data-slot="card"]') as HTMLElement);
  expect(card.getByText('2')).toBeTruthy();
});
it('el aceptado sin CDR no ofrece resolución de DLQ', async () => {
  render(<InvoiceMonitorPage />); await screen.findByText(final.numero);
  expect(screen.queryByRole('button', { name: 'Resolver DLQ' })).toBeNull();
});
it('un error del servidor al resolver conserva la fila y muestra el motivo', async () => {
  const original = vi.mocked(apiClient.get).getMockImplementation()!;
  vi.mocked(apiClient.get).mockImplementation(async (url, options) => {
    const response = await original(url, options) as { data: { data: ReturnType<typeof raw>[] } };
    if (url === '/invoices' && (options?.params as Record<string, string> | undefined)?.en_dlq === 'true') {
      return { data: { ...response.data, data: response.data.data.map((row: { id: string }) => row.id === final.id ? { ...row, cdr_codigo: '0' } : row) } };
    }
    return response;
  });
  vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { message: 'No se pudo limpiar la cola.' } } });
  render(<InvoiceMonitorPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Resolver DLQ' }));
  expect(await screen.findByText('No se pudo limpiar la cola.')).toBeTruthy();
  expect(screen.getByText(final.numero)).toBeTruthy();
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/invoices/80/resolver-dlq');
});
