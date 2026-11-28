import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import InvoiceList from '@/modules/invoices/InvoiceList';
import { cargarProductosAlmacen } from '@/modules/invoices/services/inventoryProductsApi';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { apiClient } from '@/lib/axios';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
import { borradorInicial, vincularDocumentoAfectado } from '@/modules/invoices/lib/invoiceEmitDraft';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { lineasParaNota } from '@/modules/invoices/lib/invoiceLineasOrigen';
import { hoyEnLima } from '@/modules/invoices/lib/invoiceFecha';
import { useAuthStore } from '@/stores/authStore';
import type { Invoice } from '@/modules/invoices/types/invoice.types';
vi.mock('@/modules/invoices/hooks/useInvoiceWritePermission',()=>({useInvoiceWritePermission:()=>true}));
vi.mock('@/modules/auth/hooks/useActionPermissions',()=>({useActionPermissions:()=>({can:()=>false,canShow:()=>false})}));
vi.mock('@/modules/invoices/hooks/useInvoiceDatePermission',()=>({useInvoiceDatePermission:()=>({canEditDate:true})}));
vi.mock('@/modules/invoices/components/RetencionMaestro',()=>({RetencionMaestro:()=>null}));
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[])}));
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{getInvoices:vi.fn(),getInvoiceById:vi.fn(),getSaldoNota:vi.fn(),emitirComprobante:vi.fn(),buscarClientes:vi.fn(async()=>[])}}));
const lineas=[{codigo:'P',descripcion:'Producto origen',unidad:'NIU',cantidad:2,valor_unitario:50,precio_unitario:59,afectacion:'10'}];
const factura:Invoice={id:'f',numero:'F001-00000001',serie:'F001',correlativo:1,tipoComprobante:'01',estadoBackend:'ACEPTADO',cdrStatus:'ACEPTADO_SUNAT',cdrCodigo:'0',fechaEmision:'2026-11-01',clienteRuc:'20100070970',clienteRazonSocial:'Cliente origen',moneda:'PEN',subtotal:100,igv:18,total:118,formaPago:'Contado',cuotas:[],lineasOrigen:lineas};
const boleta:Invoice={...factura,id:'b',numero:'B001-00000002',serie:'B001',correlativo:2,tipoComprobante:'03',clienteRuc:'12345678'};
const saldo={total:118,devuelto:0,disponible:118,motivos_totales:['01','02','06'],cantidades_pendientes:[{codigo:'P',original:2,pendiente:2}]};
const series=[['01','F001'],['03','B001'],['07','FC01'],['07','BC01'],['08','FD01'],['08','BD01']].map(([document_type,series])=>({document_type,series,is_active:true,current_correlative:0}));
let qc:QueryClient;
beforeEach(()=>{
 HTMLElement.prototype.scrollIntoView=vi.fn();
 vi.clearAllMocks();vi.mocked(cargarProductosAlmacen).mockResolvedValue([]);localStorage.clear();useAuthStore.setState({user:{id:'note-test',email:'test@example.invalid',role:'ADMIN'},activeCompany:{tenantId:'note-company',ruc:'20100070970',razonSocial:'Empresa'}});
 vi.mocked(apiClient.get).mockImplementation(async url=>({data:url==='/invoices/config'?{series,perfil_comercial:'MINORISTA'}:url==='/invoices/commercial-defaults'?{forma_pago:'Contado',medio_pago:'EFECTIVO'}:[]}));
 vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:[factura,boleta],total:2,page:1,pageSize:100,totalPages:1});
 vi.mocked(invoicesApi.getInvoiceById).mockImplementation(async id=>id==='b'?boleta:factura);
 vi.mocked(invoicesApi.getSaldoNota).mockResolvedValue(saldo);
 vi.mocked(invoicesApi.emitirComprobante).mockRejectedValue(new Error('Captura local'));
 qc=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false}}});
});
afterEach(()=>{cleanup();qc.clear();localStorage.clear();vi.restoreAllMocks();});
async function mount(tipo='07', incrustado=false){
 render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[incrustado ? `/invoices/notas?tipo=${tipo}` : `/invoices/emision?tipo=${tipo}`]}>{incrustado ? <InvoiceList/> : <InvoiceEmissionPage/>}</MemoryRouter></QueryClientProvider>);
 await screen.findByRole('option',{name:/F001-00000001/});
 expect(screen.getByLabelText('Tipo de comprobante')).toHaveValue(tipo);
}
async function elegir(numero='F001-00000001'){
 fireEvent.change(screen.getByLabelText('Documento afectado'),{target:{value:numero}});
 await screen.findByLabelText('Cantidad de la línea 1');
 await waitFor(()=>expect(screen.queryByText('Consultando saldo del comprobante…')).toBeNull());
}
async function confirmar(){fireEvent.submit(document.querySelector('form')!);expect(await screen.findByRole('dialog',{name:'Revisar y emitir'})).toBeTruthy();expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirmar emisión'}));}
it.each([['07','F001-00000001','FC01'],['07','B001-00000002','BC01'],['08','F001-00000001','FD01'],['08','B001-00000002','BD01']])('nota %s sobre %s conserva serie %s y el payload del traductor anterior',async(tipo,numero,serie)=>{
 await mount(tipo);await elegir(numero);
 expect(screen.getByLabelText('Serie configurada')).toHaveValue(serie);
 expect(screen.getByLabelText('Razón social / nombre')).toBeDisabled();
 expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue(2);
 await confirmar();await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalled());
 const existentes=[factura,boleta].map(aComprobanteDemo);
 const b=vincularDocumentoAfectado({...borradorInicial(tipo as '07'|'08',hoyEnLima()),documentoAfectado:numero},existentes).borrador;
 const expected=borradorAPayloadEmision({...b,serie,items:lineasParaNota(lineas)!});
 expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0]).toEqual(expected);
 expect(invoicesApi.getSaldoNota).toHaveBeenCalledTimes(2);
});
it('sin documento origen no abre la revisión ni emite',async()=>{await mount();fireEvent.submit(document.querySelector('form')!);expect(screen.queryByRole('dialog')).toBeNull();expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();});
it('bloquea saldo insuficiente antes de revisar',async()=>{vi.mocked(invoicesApi.getSaldoNota).mockResolvedValue({...saldo,disponible:100});await mount();await elegir();fireEvent.submit(document.querySelector('form')!);expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getAllByText(/supera el saldo disponible/).length).toBeGreaterThan(0);expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();});
it('revalida el saldo inmediatamente antes de emitir',async()=>{await mount();await elegir();vi.mocked(invoicesApi.getSaldoNota).mockResolvedValue({...saldo,disponible:50});await confirmar();expect(await screen.findByText(/supera el saldo actualizado/)).toBeTruthy();expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();});
it('las cantidades totales del servidor se validan además del dinero',async()=>{await mount();await elegir();fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'),{target:{value:'1'}});fireEvent.submit(document.querySelector('form')!);expect(screen.getAllByText(/motivo total exige todas las unidades/).length).toBeGreaterThan(0);expect(screen.queryByRole('dialog')).toBeNull();});
it('un cambio de cantidades en el servidor se comprueba al confirmar',async()=>{await mount();await elegir();vi.mocked(invoicesApi.getSaldoNota).mockResolvedValue({...saldo,cantidades_pendientes:[{codigo:'P',original:3,pendiente:3}]});await confirmar();expect(await screen.findByText(/motivo total exige todas las unidades/)).toBeTruthy();expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();});
it('un refresco de saldo no sobrescribe las cantidades editadas',async()=>{await mount();await elegir();fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'),{target:{value:'1'}});await act(async()=>{await qc.invalidateQueries({queryKey:['invoice-saldo-nota','f']});});expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue(1);});


async function motivo(codigo:string){fireEvent.keyDown(screen.getByLabelText('Motivo de la nota'),{key:'ArrowDown'});fireEvent.click(await screen.findByRole('option',{name:new RegExp(`^${codigo} -`)}));}
it('07/13 hereda crédito y cuotas del origen sin que el predeterminado comercial las borre',async()=>{
 const credito={...factura,formaPago:'Credito' as const,cuotas:[{numero:'Cuota001',monto:118,vencimiento:'2027-02-01'}]};
 vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:[credito],total:1,page:1,pageSize:100,totalPages:1});vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue(credito);
 await mount();await elegir();await motivo('13');await waitFor(()=>expect(screen.getByRole('button',{name:'Crédito'})).toHaveAttribute('aria-pressed','true'));
 await confirmar();await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalled());
 expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0]).toMatchObject({forma_pago:'Credito',cuotas:[{monto:118,vencimiento:'2027-02-01'}],codigo_motivo_nota:'13',fecha_emision:hoyEnLima()});
});
it('Otros conceptos exige su sustento y mantiene 08 Bonificación fuera del catálogo',async()=>{
 await mount();await elegir();fireEvent.keyDown(screen.getByLabelText('Motivo de la nota'),{key:'ArrowDown'});expect(screen.queryByRole('option',{name:/08 - Bonificación/})).toBeNull();fireEvent.click(screen.getByRole('option',{name:'10 - Otros conceptos'}));
 fireEvent.submit(document.querySelector('form')!);expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.change(screen.getByLabelText('Sustento de Otros conceptos'),{target:{value:'Ajuste monetario sustentado'}});await confirmar();await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalled());
 expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0]).toMatchObject({codigo_motivo_nota:'10',descripcion_motivo_nota:'Ajuste monetario sustentado'});
});
it('ND aplica un importe parcial con el helper existente y preserva identidad y cantidad',async()=>{
 await mount('08');await elegir();fireEvent.change(screen.getByLabelText('Importe de la nota de débito'),{target:{value:'59'}});fireEvent.click(screen.getByRole('button',{name:'Aplicar importe parcial'}));await confirmar();await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalled());
 expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0].items[0]).toMatchObject({codigo:'P',unidad:'NIU',cantidad:2,valorUnitario:25,precioUnitario:29.5,afectacion:'10'});
});
it('precarga la cantidad pendiente y limita desde el primer detalle',async()=>{
 vi.mocked(invoicesApi.getSaldoNota).mockResolvedValue({...saldo,devuelto:59,disponible:59,cantidades_pendientes:[{codigo:'P',original:2,pendiente:1}]});await mount();await elegir();expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue(1);expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveAttribute('max','1');
});
it.each([false,true])('el borrador local de Nota en contexto incrustado=%s conserva origen, motivo y cantidades editadas',async incrustado=>{
 await mount('07',incrustado);await elegir();await motivo('07');fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'),{target:{value:'1'}});
 const key=`m1:${incrustado?'emision-notas':'emision'}:v1:note-company:note-test`;await waitFor(()=>expect(JSON.parse(localStorage.getItem(key)??'null')?.data.items[0].cantidad).toBe(1));
 cleanup();qc.clear();qc=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});await mount('07',incrustado);fireEvent.click(screen.getByRole('button',{name:'Retomar borrador'}));await screen.findByLabelText('Cantidad de la línea 1');
 expect(screen.getByLabelText('Documento afectado')).toHaveValue('F001-00000001');expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue(1);
 await waitFor(()=>expect(screen.queryByText('Consultando saldo del comprobante…')).toBeNull());await confirmar();await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalled());expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0]).toMatchObject({codigo_motivo_nota:'07',items:[expect.objectContaining({cantidad:1})]});
});
it('una respuesta tardía del origen no pisa una línea añadida por el usuario',async()=>{
 let resolve!:(value:Invoice)=>void;vi.mocked(invoicesApi.getInvoiceById).mockReturnValue(new Promise(r=>{resolve=r;}));
 vi.mocked(cargarProductosAlmacen).mockResolvedValue([{sku:'SERV',descripcion:'Servicio elegido',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true}]);
 await mount();fireEvent.change(screen.getByLabelText('Documento afectado'),{target:{value:'F001-00000001'}});await waitFor(()=>expect(invoicesApi.getInvoiceById).toHaveBeenCalledWith('f'));
 fireEvent.change(screen.getByLabelText('Buscar producto'),{target:{value:'SERV'}});fireEvent.click(await screen.findByRole('button',{name:/SERV.*Servicio elegido/}));await act(async()=>{resolve(factura);});expect(screen.getByLabelText('Descripción de la línea 1')).toHaveTextContent('Servicio elegido');
});

it.each([['07','F001-00000001','FC01'],['07','B001-00000002','BC01'],['08','F001-00000001','FD01'],['08','B001-00000002','BD01']])('Notas incrusta %s sobre %s, conserva serie %s y emite el mismo payload tras revisión',async(tipo,numero,serie)=>{
 await mount(tipo,true);await elegir(numero);
 expect(screen.getByRole('region',{name:'Emisión de notas'})).toBeVisible();
 expect(screen.getByRole('heading',{name:'Notas emitidas'})).toBeVisible();
 expect(screen.getByLabelText('Tipo de comprobante')).toHaveValue(tipo);
 expect([...screen.getByLabelText('Tipo de comprobante').querySelectorAll('option')].map(o=>o.value)).toEqual(['07','08']);
 expect(screen.queryByRole('button',{name:'Emitir Comprobante'})).toBeNull();
 expect(screen.getByLabelText('Serie configurada')).toHaveValue(serie);
 await confirmar();await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalled());
 const b=vincularDocumentoAfectado({...borradorInicial(tipo as '07'|'08',hoyEnLima()),documentoAfectado:numero},[factura,boleta].map(aComprobanteDemo)).borrador;
 expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0]).toEqual(borradorAPayloadEmision({...b,serie,items:lineasParaNota(lineas)!}));
});
it('los filtros de la lista no reinician la nota ni agregan otro formulario',async()=>{
 await mount('07',true);await elegir();fireEvent.change(screen.getByLabelText('Buscar comprobantes'),{target:{value:'SIN-COINCIDENCIAS'}});
 expect(screen.getByLabelText('Documento afectado')).toHaveValue('F001-00000001');expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue(2);
 expect(document.querySelectorAll('form')).toHaveLength(1);expect(screen.getByRole('heading',{name:'Notas emitidas'})).toBeVisible();
 fireEvent.change(screen.getByLabelText('Tipo de comprobante'),{target:{value:'08'}});expect(screen.getByLabelText('Tipo de comprobante')).toHaveValue('08');
 expect(screen.queryByRole('option',{name:'Factura Electrónica'})).toBeNull();
});
