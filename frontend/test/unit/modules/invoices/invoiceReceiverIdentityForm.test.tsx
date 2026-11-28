import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { cleanup, render, renderHook, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import InvoiceList from '@/modules/invoices/InvoiceList';
import { masterDataApi } from '@/modules/customs/services/masterDataApi';
import { apiClient } from '@/lib/axios';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { useAuthStore } from '@/stores/authStore';
import { useInvoiceReceiverIdentity } from '@/modules/invoices/hooks/useInvoiceReceiverIdentity';
import type { BusinessPartnerRecord } from '@/modules/customs/services/masterDataApi';
import type { Invoice } from '@/modules/invoices/types/invoice.types';
vi.mock('@/modules/invoices/hooks/useInvoiceWritePermission',()=>({useInvoiceWritePermission:()=>true}));
vi.mock('@/modules/auth/hooks/useActionPermissions',()=>({useActionPermissions:()=>({can:()=>false,canShow:()=>false})}));
vi.mock('@/modules/invoices/hooks/useInvoiceDatePermission',()=>({useInvoiceDatePermission:()=>({canEditDate:true})}));
vi.mock('@/modules/invoices/components/RetencionMaestro',()=>({RetencionMaestro:()=>null}));
vi.mock('@/modules/customs/services/masterDataApi',()=>({masterDataApi:{getPartners:vi.fn(),getPartner:vi.fn()}}));
vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn()}}));
vi.mock('@/modules/invoices/services/rucApi',()=>({consultarRuc:vi.fn(async()=>{throw Error('Sin proveedor en pruebas');}),consultarDni:vi.fn(async()=>{throw Error('Sin proveedor en pruebas');})}));
vi.mock('@/modules/invoices/services/inventoryProductsApi',()=>({cargarProductosAlmacen:vi.fn(async()=>[{sku:'SERV',descripcion:'Producto',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:10,vendible:true}])}));
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{getInvoices:vi.fn(),getInvoiceById:vi.fn(),getSaldoNota:vi.fn(),emitirComprobante:vi.fn()}}));
const registered:BusinessPartnerRecord={id:'registered',company_id:'company',country_code:'PE',doc_type:'6',doc_number:'20100070970',legal_name:'FERRETERÍA LOS ANDES S.A.C.',roles:['CLIENTE'],is_active:true,has_credit:false,allows_discount:false,address:null};
const dni:BusinessPartnerRecord={...registered,id:'dni',doc_type:'1',doc_number:'12345678',legal_name:'José Pérez García'};
const origin:Invoice={id:'f',numero:'F001-00000102',serie:'F001',correlativo:102,tipoComprobante:'01',estadoBackend:'ACEPTADO',cdrStatus:'ACEPTADO_SUNAT',fechaEmision:'2026-11-01',clienteRuc:registered.doc_number,clienteRazonSocial:'SUPERMERCADOS PERUANOS',moneda:'PEN',subtotal:100,igv:18,total:118,formaPago:'Contado',cuotas:[],lineasOrigen:[{codigo:'P',descripcion:'Producto',unidad:'NIU',cantidad:1,valor_unitario:100,precio_unitario:118,afectacion:'10'}]};
let query:QueryClient;
beforeEach(()=>{
 vi.resetAllMocks();localStorage.clear();sessionStorage.clear();HTMLElement.prototype.scrollIntoView=vi.fn();
 useAuthStore.setState({user:{id:'user',email:'test@example.invalid',role:'ADMIN'},activeCompany:{tenantId:'company',ruc:'20100070970',razonSocial:'Empresa'}});
 vi.mocked(masterDataApi.getPartners).mockResolvedValue([registered,dni]);
 vi.mocked(apiClient.get).mockImplementation(async url=>({data:url==='/invoices/config'?{series:[['01','F001'],['03','B001'],['07','FC01'],['08','FD01']].map(([document_type,series])=>({document_type,series,is_active:true}))}:url==='/invoices/commercial-defaults'?{forma_pago:'Contado',medio_pago:'EFECTIVO'}:[]}));
 vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:[origin],total:1,page:1,pageSize:100,totalPages:1});
 vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue(origin);
 vi.mocked(invoicesApi.getSaldoNota).mockResolvedValue({total:118,devuelto:0,disponible:118,motivos_totales:['01','02','06'],cantidades_pendientes:[{codigo:'P',original:1,pendiente:1}]});
 vi.mocked(invoicesApi.emitirComprobante).mockRejectedValue(Error('Captura local'));
 query=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
});
afterEach(()=>{cleanup();query.clear();localStorage.clear();sessionStorage.clear();vi.restoreAllMocks();});
async function mount(tipo='01',notas=false){render(<QueryClientProvider client={query}><MemoryRouter initialEntries={[`${notas?'/invoices/notas':'/invoices/emision'}?tipo=${tipo}`]}>{notas?<InvoiceList/>:<InvoiceEmissionPage/>}</MemoryRouter></QueryClientProvider>);await screen.findByRole('option',{name:tipo==='03'?'B001':tipo==='01'?'F001':tipo==='07'?'FC01':'FD01'});}
async function linea(){fireEvent.change(screen.getByLabelText('Buscar producto'),{target:{value:'SERV'}});fireEvent.click(await screen.findByRole('button',{name:/SERV · Producto/}));}
async function settled(){await waitFor(()=>expect(query.isFetching({queryKey:['master-data','invoice-receiver-identity']})).toBe(0));}
function submit(){fireEvent.submit(document.querySelector('form')!);}
it('la discrepancia auditada bloquea revisión y emisión con el nombre del maestro',async()=>{
 await mount();fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:registered.doc_number}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'SUPERMERCADOS PERUANOS'}});await linea();await settled();submit();
 expect(screen.queryByRole('dialog',{name:'Revisar y emitir'})).toBeNull();expect(screen.getAllByText(/La razón social no coincide.*FERRETERÍA LOS ANDES S.A.C./).length).toBeGreaterThan(0);expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();expect(masterDataApi.getPartners).toHaveBeenCalledWith({q:registered.doc_number});
});
it.each([registered.legal_name,'  ferreteria   LOS andes s.a.c.  '])('el nombre coincidente %s permite revisar sin reescribir el payload',async nombre=>{
 await mount();fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:registered.doc_number}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:nombre}});await linea();await settled();submit();expect(screen.getByRole('dialog',{name:'Revisar y emitir'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Confirmar emisión'}));await waitFor(()=>expect(invoicesApi.emitirComprobante).toHaveBeenCalled());expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0].customer_legal_name).toBe(nombre.trim());
});
it('un receptor no registrado sigue pudiendo revisar',async()=>{
 await mount();fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:'20552103816'}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'Cliente ocasional'}});await linea();await settled();submit();expect(screen.getByRole('dialog',{name:'Revisar y emitir'})).toBeVisible();
});
it.each([registered,dni])('boleta conserva la selección de $doc_type/$doc_number desde el maestro',async partner=>{
 await mount('03');fireEvent.change(screen.getByLabelText('DNI / documento del comprador'),{target:{value:partner.doc_number}});fireEvent.click(await screen.findByRole('button',{name:new RegExp(partner.legal_name)}));await linea();await settled();submit();expect(screen.getByRole('dialog',{name:'Revisar y emitir'})).toBeVisible();expect(screen.getByText(`${partner.doc_number} · ${partner.legal_name}`)).toBeVisible();
});
it.each(['07','08'])('Notas %s también bloquea un receptor del origen que discrepa del maestro',async tipo=>{
 await mount(tipo,true);fireEvent.change(screen.getByLabelText('Documento afectado'),{target:{value:origin.numero}});await screen.findByLabelText('Cantidad de la línea 1');await settled();submit();expect(screen.queryByRole('dialog',{name:'Revisar y emitir'})).toBeNull();expect(screen.getAllByText(/La razón social no coincide/).length).toBeGreaterThan(0);expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
});
it('un fallo de lectura no se confunde con documento ausente y permite reintentar',async()=>{
 vi.mocked(masterDataApi.getPartners).mockRejectedValue(Error('Sin conexión'));await mount();fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:registered.doc_number}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:registered.legal_name}});await linea();await settled();submit();expect(screen.queryByRole('dialog')).toBeNull();expect((await screen.findAllByText(/No se pudo verificar la identidad/)).length).toBeGreaterThan(0);
 vi.mocked(masterDataApi.getPartners).mockResolvedValue([registered]);await settled();submit();await settled();submit();expect(await screen.findByRole('dialog',{name:'Revisar y emitir'})).toBeVisible();
});

it('también cruza terceros registrados inactivos o de otro rol',async()=>{
 vi.mocked(masterDataApi.getPartners).mockResolvedValue([{...registered,roles:['PROVEEDOR'],is_active:false}]);
 await mount();fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:registered.doc_number}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'Nombre ajeno'}});await linea();await settled();submit();expect(screen.getAllByText(/La razón social no coincide/).length).toBeGreaterThan(0);expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
});
it('reutiliza la selección del maestro sin otra consulta y detecta un nombre ajeno',()=>{
 const selected={id:registered.id,tipoDocumento:'6',numeroDocumento:registered.doc_number,razonSocial:registered.legal_name};
 const {result}=renderHook(()=>useInvoiceReceiverIdentity(registered.doc_number,'Nombre ajeno',selected,'01'),{wrapper:({children})=><QueryClientProvider client={query}>{children}</QueryClientProvider>});
 expect(result.current.problema?.mensaje).toContain(registered.legal_name);expect(masterDataApi.getPartners).not.toHaveBeenCalled();
});
it('la confirmación vuelve a bloquear si cambia el nombre registrado durante la revisión',async()=>{
 await mount();fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:registered.doc_number}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:registered.legal_name}});await linea();await settled();submit();expect(screen.getByRole('dialog',{name:'Revisar y emitir'})).toBeVisible();
 await act(async()=>{query.setQueriesData({queryKey:['master-data','invoice-receiver-identity']},[{...registered,legal_name:'Nombre registrado actualizado'}]);await new Promise(resolve=>setTimeout(resolve,0));});
 fireEvent.click(screen.getByRole('button',{name:'Confirmar emisión'}));expect(screen.queryByRole('dialog',{name:'Revisar y emitir'})).toBeNull();expect(screen.getAllByText(/Nombre registrado actualizado/).length).toBeGreaterThan(0);expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
});
it('espera la lectura del maestro y no interpreta una consulta pendiente como ausencia',async()=>{
 let resolver!:(rows:BusinessPartnerRecord[])=>void;
 vi.mocked(masterDataApi.getPartners).mockImplementation(()=>new Promise(resolve=>{resolver=resolve;}));
 await mount();fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:registered.doc_number}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'Nombre ajeno'}});await linea();submit();expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getAllByText(/Consultando la identidad/).length).toBeGreaterThan(0);
 await act(async()=>{resolver([registered]);});await settled();submit();expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();
});

it.each([registered,dni])('boleta bloquea el nombre ajeno para $doc_number antes de revisar',async partner=>{
 await mount();fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:partner.doc_number}});fireEvent.change(screen.getByLabelText('Razón social / nombre'),{target:{value:'Nombre ajeno'}});await linea();fireEvent.change(screen.getByLabelText('Tipo de comprobante'),{target:{value:'03'}});await settled();submit();
 expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getAllByText(new RegExp(partner.doc_number+': '+partner.legal_name)).length).toBeGreaterThan(0);expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
});
it('Notas permite revisar cuando el receptor del origen coincide con el maestro',async()=>{
 const matching={...origin,clienteRazonSocial:'ferreteria los andes s.a.c.'};vi.mocked(invoicesApi.getInvoices).mockResolvedValue({data:[matching],total:1,page:1,pageSize:100,totalPages:1});vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue(matching);
 await mount('07',true);fireEvent.change(screen.getByLabelText('Documento afectado'),{target:{value:origin.numero}});await screen.findByLabelText('Cantidad de la línea 1');await settled();submit();expect(screen.getByRole('dialog',{name:'Revisar y emitir'})).toBeVisible();
});
