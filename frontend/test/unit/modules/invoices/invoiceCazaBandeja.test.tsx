import '@testing-library/jest-dom/vitest';
// Este flujo aísla los permisos; invoiceServerPermissions prueba los hooks reales y la API.
vi.mock('@/modules/invoices/hooks/useInvoiceWritePermission', async () => {
 const { useAuthStore } = await import('@/stores/authStore');
 const { serverSnapshot } = await import('../../../fixtures/permissionsServer');
 return { INVOICE_WRITE_DENIED: 'Su rol no permite emitir ni operar envíos de facturación.', useInvoiceWritePermission: () => { useAuthStore(s=>s.user); const p=serverSnapshot();return p.modules.some(m=>m.moduleCode==='M1'&&m.canWrite)&&p.actions.some(a=>a.actionCode==='INVOICE_EMIT'&&a.allowed); } };
});
vi.mock('@/modules/auth/hooks/useActionPermissions', async () => {
 const { useAuthStore }=await import('@/stores/authStore');const {serverSnapshot}=await import('../../../fixtures/permissionsServer');
 return {useActionPermissions:()=>{useAuthStore(s=>s.user);const p=serverSnapshot();return {can:(code:string)=>p.actions.some(a=>a.actionCode===code&&a.allowed),canShow:(code:string)=>p.actions.some(a=>a.actionCode===code&&a.available),ready:true,isLoading:false,isError:false};}};
});
vi.mock('@/modules/invoices/hooks/useInvoiceDatePermission', () => ({ useInvoiceDatePermission: () => ({ canEditDate: true, explanation: undefined }) }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceList } from '@/modules/invoices/InvoiceList';
import { InvoiceCdrModal } from '@/modules/invoices/components/InvoiceCdrModal';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
import { FILTROS_ESTADO } from '@/modules/invoices/components/InvoiceFiltersBar';
import { aplicarFiltros } from '@/modules/invoices/lib/invoiceFilters';
import { descargarDesdeBackend } from '@/modules/invoices/lib/invoiceDescarga';
import { extractApiErrorMessage } from '@/lib/apiErrors';
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { getInvoices: vi.fn(), getInvoiceById: vi.fn() } }));
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({ obtenerXmlDesdeBackend: vi.fn(async () => null), extraerDigestValue: vi.fn(() => null), descargarDesdeBackend: vi.fn() }));
const item = (id: string, tipo: string, estado: string, cliente: string) => aInvoice({ id, tipo_comprobante: tipo, serie: tipo === '07' ? 'FC01' : 'F001', correlativo: Number(id), numero: `F001-0000000${id}`, fecha_emision: '2026-11-07', estado, monto_total: 118, moneda: 'PEN', cliente_documento: '20100070970', cliente_nombre: cliente, cdr_codigo: estado === 'ACEPTADO' ? '0' : null });
const filas = [item('1','01','ACEPTADO','Cliente uno'),item('2','01','ERROR_RED','Cliente dos'),item('3','07','ACEPTADO','Cliente dos')];
const queries: QueryClient[] = [];
beforeEach(() => { vi.mocked(invoicesApi.getInvoices).mockResolvedValue({ data: filas, total: 3, page: 1, pageSize: 100, totalPages: 1 }); });
afterEach(() => { cleanup(); sessionStorage.clear(); queries.splice(0).forEach((q) => q.clear()); vi.resetAllMocks(); });
it('F3 Error de red selecciona solo filas ERROR_RED tras el mapper real', () => {
  const opcion = FILTROS_ESTADO.find((f) => f.value === 'ERROR_RED')!;
  expect(opcion).toBeTruthy();
  expect(aplicarFiltros(filas.map(aComprobanteDemo), { busqueda: '', estado: opcion.value, desde: '', hasta: '' }).map((c) => c.id)).toEqual(['2']);
});
it('F4 la lista filtra el conjunto sin la franja de pestañas', async () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); queries.push(q);
  render(<QueryClientProvider client={q}><MemoryRouter initialEntries={['/invoices']}><InvoiceList /></MemoryRouter></QueryClientProvider>);
  await screen.findByText('Cliente uno');
  expect(screen.queryByRole('tablist', { name: 'Apartados del módulo de facturación' })).toBeNull();
  expect(screen.getAllByRole('row')).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('Buscar comprobantes'), { target: { value: 'Cliente dos' } });
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.queryByText('Cliente uno')).toBeNull();
  expect(screen.getByText('Cliente dos')).toBeTruthy();
});
it.each([false, true])('F5 CDR disponible=%s controla la descarga y extrae el motivo del servidor', async (tieneCdr) => {
  vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue({ ...filas[0], tieneCdr, historial: [] });
  vi.mocked(descargarDesdeBackend).mockRejectedValue({ message: 'Request failed with status code 404', response: { data: { detail: 'El CDR no está disponible en el almacén.' } } });
  render(<InvoiceCdrModal comprobante={aComprobanteDemo(filas[0])} onCerrar={vi.fn()} />);
  const boton = screen.getByRole('button', { name: 'Descargar CDR' }) as HTMLButtonElement;
  expect(boton.disabled).toBe(true);
  await screen.findByText('No hay eventos de auditoría registrados.');
  await waitFor(() => expect(boton.disabled).toBe(!tieneCdr));
  fireEvent.click(boton);
  if (tieneCdr) { expect(await screen.findByText(/El CDR no está disponible en el almacén/)).toBeTruthy(); expect(screen.queryByText('Request failed with status code 404')).toBeNull(); }
  else expect(descargarDesdeBackend).not.toHaveBeenCalled();
});
it('F5 usa un fallback legible cuando HTTP no trae motivo', () => {
  expect(extractApiErrorMessage(new Error('Request failed with status code 404'), 'No se pudo descargar.')).toBe('No se pudo descargar.');
});
it('Parte 9 descarga el PDF oficial desde el detalle de la fila', async () => {
 const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); queries.push(q);
 vi.mocked(descargarDesdeBackend).mockResolvedValue(undefined);
 render(<QueryClientProvider client={q}><MemoryRouter><InvoiceList /></MemoryRouter></QueryClientProvider>);
 const row=(await screen.findByText('Cliente uno')).closest('tr')!;fireEvent.click(row);
 fireEvent.click(await screen.findByRole('button',{name:'Descargar PDF Homologado'}));
 await waitFor(()=>expect(descargarDesdeBackend).toHaveBeenCalledWith('1','pdf'));
});
it('Bandeja deriva F001-52 exonerada y agrega ICBPER por el recorrido real de lista y detalle',async()=>{
 const raw=(id:string,total:number,estado:string)=>aInvoice({id,tipo_comprobante:'01',serie:'F001',correlativo:Number(id),numero:`F001-${id.padStart(8,'0')}`,fecha_emision:'2026-11-12',estado,monto_total:total,moneda:'PEN',base_imponible:0,total_igv:0,cliente_documento:'20100070970',cliente_nombre:`Cliente ${id}`,cdr_codigo:null});
 const rows=[raw('52',950,'ERROR_RED'),raw('73',118.5,'ACEPTADO'),raw('90',950,'ACEPTADO')];
 vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:rows,total:3,page:1,pageSize:100,totalPages:1});
 vi.mocked(invoicesApi.getInvoiceById).mockImplementation(async id=>({...rows.find(r=>r.id===id)!,lineasOrigen:[{codigo:'P',descripcion:'Flete',unidad:'NIU',cantidad:1,valor_unitario:id==='73'?100:950,precio_unitario:id==='73'?118:1121,afectacion:id==='73'?'10':'20',icbper:id==='73'?.5:0}]}));
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});queries.push(q);
 const {container}=render(<QueryClientProvider client={q}><MemoryRouter><InvoiceList/></MemoryRouter></QueryClientProvider>);
 const row=(await screen.findByText('Cliente 52')).closest('tr')!;
 expect(within(row).getAllByText('S/ 950.00')).toHaveLength(2);expect(within(row).getByText('S/ 0.00')).toBeTruthy();expect(within(row).queryByText('S/ 171.00')).toBeNull();
 const kpi=container.querySelector('[data-kpi="total"]')!;expect(kpi.textContent).toMatch(/1,068.50/);expect(kpi.textContent).toMatch(/1,050.00.*18.00.*ICBPER S\/ 0.50/);
});
it('primera emisión ofrece una salida y los filtros vacíos se pueden limpiar',async()=>{
 vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:[],total:0,page:1,pageSize:100,totalPages:1});
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});queries.push(q);
 const vista=render(<QueryClientProvider client={q}><MemoryRouter><InvoiceList/></MemoryRouter></QueryClientProvider>);
 expect(await screen.findByText('Aún no emites comprobantes')).toBeTruthy();expect(screen.getByRole('link',{name:'Emitir el primero'})).toHaveAttribute('href','/invoices/emision');vista.unmount();q.clear();
 vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:filas,total:3,page:1,pageSize:100,totalPages:1});
 render(<QueryClientProvider client={q}><MemoryRouter initialEntries={['/invoices/facturas?m1=1&busqueda=SinCoincidencia']}><InvoiceList/></MemoryRouter></QueryClientProvider>);
 expect(await screen.findByText('No hay comprobantes para los filtros elegidos')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Limpiar filtros'}));expect(await screen.findByText('Cliente uno')).toBeTruthy();
});
it('la fila abre el detalle modal y conserva sus descargas',async()=>{
 vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue({...filas[0],tieneCdr:true,historial:[]});
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});queries.push(q);
 render(<QueryClientProvider client={q}><MemoryRouter><InvoiceList/></MemoryRouter></QueryClientProvider>);
 const row=(await screen.findByText('Cliente uno')).closest('tr')!;row.focus();fireEvent.keyDown(row,{key:'Enter'});
 const modal=await screen.findByRole('dialog',{name:/F001-00000001/});
 expect(screen.queryByRole('region',{name:/F001-00000001/})).toBeNull();expect(within(modal).getByRole('button',{name:'Descargar XML Oficial'})).toBeTruthy();
 fireEvent.click(within(modal).getByRole('button',{name:'Cerrar'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await waitFor(()=>expect(row).toHaveFocus());
});
it('el enlace de indicadores incluye notas sin mezclar estados y permite quitar el alcance ampliado',async()=>{
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});queries.push(q);
 render(<QueryClientProvider client={q}><MemoryRouter initialEntries={['/invoices/facturas?m1=1&incluir_notas=1&estado=ACEPTADAS']}><InvoiceList/></MemoryRouter></QueryClientProvider>);
 await screen.findByText('F001-00000001');expect(screen.getByText('FC01-00000003')).toBeTruthy();expect(screen.queryByText('F001-00000002')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Tipos: facturas, boletas y notas · Quitar filtro'}));expect(screen.queryByText('FC01-00000003')).toBeNull();expect(screen.getByText('F001-00000001')).toBeTruthy();
});

it('la lectura real del detalle actualiza el estado persistente de su fila sin otra consulta de lista',async()=>{
 const final=aInvoice({id:'2',tipo_comprobante:'01',serie:'F001',correlativo:2,numero:'F001-00000002',fecha_emision:'2026-11-07',estado:'ACEPTADO',monto_total:118,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:'Cliente dos',cdr_codigo:'0'});
 vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue(final);
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});queries.push(q);
 render(<QueryClientProvider client={q}><MemoryRouter><InvoiceList/></MemoryRouter></QueryClientProvider>);
 const row=(await screen.findByText('Cliente dos')).closest('tr')!;expect(within(row).getByLabelText('Interrumpida por conexión')).toBeTruthy();
 fireEvent.click(row);await waitFor(()=>expect(row.querySelector('[aria-label="Aceptada"]')).toBeTruthy());
 expect(invoicesApi.getInvoices).toHaveBeenCalledTimes(1);
});
