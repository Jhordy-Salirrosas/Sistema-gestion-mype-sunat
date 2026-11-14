import { invoiceDetailFromDemo } from '../../../fixtures/invoiceDetailFromDemo';
import { porApartado } from '@/modules/invoices/lib/invoiceFilters';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {InvoiceStatusBadge} from '@/modules/invoices/components/InvoiceStatusBadge';
import {InvoiceKpiCards} from '@/modules/invoices/components/InvoiceKpiCards';
import {InvoiceTableRow} from '@/modules/invoices/components/InvoiceTableRow';
import {InvoiceCdrModal} from '@/modules/invoices/components/InvoiceCdrModal';
import {InvoiceTabsNav,contarPorTab,RUTA_POR_TAB} from '@/modules/invoices/components/InvoiceTabsNav';
import {Tabs} from '@/components/ui';
import {calcularResumenFiscal} from '@/modules/invoices/lib/invoiceMetrics';
import {construir} from '@/modules/invoices/data/invoiceDemoTypes';
import {clasificarBandeja,ETIQUETAS_BANDEJA} from '@/modules/invoices/lib/invoiceBandejaState';
import {invoicesApi} from '@/modules/invoices/services/invoicesApi';
vi.mock('@/modules/invoices/services/invoicesApi',()=>({invoicesApi:{getInvoiceById:vi.fn()}}));
vi.mock('@/modules/invoices/lib/invoiceDescarga',()=>({obtenerXmlDesdeBackend:vi.fn(async()=>null),extraerDigestValue:vi.fn(),descargarDesdeBackend:vi.fn()}));
vi.mock('@/modules/invoices/components/InvoiceSunatConsulta',()=>({InvoiceSunatConsulta:()=> <span>Consulta SUNAT disponible</span>}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const c=construir({tipo:'01',serie:'F001',correlativo:52,fecha:'2026-11-12',ruc:'20100070970',razonSocial:'Cliente',base:100,estado:'ACEPTADO'});
it.each([
 ['ACEPTADO',undefined],['OBSERVADO',undefined],['ERROR_RED','PREPARACION_LOCAL'],['ERROR_RED','TRANSPORTE_INCIERTO'],['RECHAZADO','SUNAT'],['ERROR_RED',undefined],['ANULADO','RA_REVERSAL_DONE'],['ACEPTADO','BRIDGE_PENDING'],['ANULADO','RA_REVERSAL_PENDING'],['RECHAZADO',undefined],['ENVIADO',undefined],
] as const)('badge %s origen %s usa categoría común',(estadoBackend,origen)=>{
 const estado=(estadoBackend==='ERROR_RED'?'SIN_CONFIRMAR':estadoBackend==='ENVIADO'?'EN_COLA':estadoBackend==='ANULADO'?'RECHAZADO':estadoBackend) as never;
 const resultado=origen?{origen,codigo:'X',motivo:null}:undefined;
 const categoria=clasificarBandeja({estado,estadoBackend,resultadoPresentacion:resultado});
 render(<InvoiceStatusBadge estado={estado} estadoBackend={estadoBackend} resultado={resultado}/>);
 expect(screen.getByLabelText(ETIQUETAS_BANDEJA[categoria])).toBeTruthy();
});
it.each([undefined,'0','9999'])('badge conserva código útil %s',(codigo)=>{
 render(<InvoiceStatusBadge estado="ACEPTADO" codigo={codigo}/>);expect(screen.getByText(codigo==='9999'?'Aceptado · 9999':'Aceptado')).toBeTruthy();
});
it('tarjeta hace visible ICBPER verificado y la igualdad al céntimo',()=>{
 const comprobante={...c,baseImponible:100,igv:18,totalNeto:118.5,importesBandeja:{base:100,igv:18,icbper:.5,total:118.5,verificado:true}};
 render(<InvoiceKpiCards resumen={calcularResumenFiscal([comprobante])}/>);expect(screen.getByText(/ICBPER S\/ 0.50/)).toBeTruthy();
});
it('KPI advierte un desglose incompleto en lugar de publicar una suma falsa',()=>{
 render(<InvoiceKpiCards resumen={calcularResumenFiscal([{...c,importesBandeja:{base:0,igv:0,icbper:0,total:118,verificado:false}}])}/>);
 expect(screen.getByText(/Desglose no verificable/)).toBeTruthy();
});
it.each([true,false])('fila verificada=%s publica importes o inconsistencia',verificado=>{
 const item={...c,baseImponible:950,igv:0,totalNeto:950.5,importesBandeja:{base:950,igv:0,icbper:.5,total:950.5,verificado}};
 render(<table><tbody><InvoiceTableRow comprobante={item} onVerXml={vi.fn()} onVerCdr={vi.fn()} onDescargarPdf={vi.fn()} onReintentarCdr={vi.fn()}/></tbody></table>);
 expect(Boolean(screen.queryByText('Desglose no verificable'))).toBe(!verificado);expect(Boolean(screen.queryByText(/ICBPER/))).toBe(verificado);
 if(verificado){expect(screen.getByText('S/ 950.00')).toBeTruthy();expect(screen.getByText('S/ 0.00')).toBeTruthy();}
});
it.each([['ERROR_RED','TRANSPORTE_INCIERTO',false,true],['ERROR_RED',undefined,false,true],['ENVIADO',undefined,false,true],['PENDIENTE',undefined,false,false],['ACEPTADO',undefined,true,false],['OBSERVADO',undefined,true,false],['ERROR_RED','PREPARACION_LOCAL',false,false],['RECHAZADO','SUNAT',false,false]] as const)('modal %s origen %s CDR=%s consulta=%s',async(estadoBackend,origen,tieneCdr,visible)=>{
 const resultadoPresentacion=origen?{origen,codigo:null,motivo:null}:undefined;
 const item={...c,estadoBackend,estado:(estadoBackend==='ERROR_RED'?'SIN_CONFIRMAR':estadoBackend==='ENVIADO'||estadoBackend==='PENDIENTE'?'EN_COLA':estadoBackend) as never,resultadoPresentacion};
 vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue({...invoiceDetailFromDemo(item),tieneCdr});
 render(<InvoiceCdrModal comprobante={item} onCerrar={vi.fn()}/>);
 expect(screen.queryByText('Consulta SUNAT disponible')).toBeNull();
 await screen.findByText('No hay eventos de auditoría registrados.');await waitFor(()=>expect(Boolean(screen.queryByText('Consulta SUNAT disponible'))).toBe(visible));
});
it('Notas tiene conteo de 15 y conserva la ruta existente',()=>{
 const rows=Array.from({length:15},(_,i)=>({...c,id:String(i),tipo:(i%2?'07':'08') as '07'|'08'}));const navegar=vi.fn();
 render(<MemoryRouter><Tabs defaultValue="comprobantes" onValueChange={x=>navegar(RUTA_POR_TAB[x as keyof typeof RUTA_POR_TAB])}><InvoiceTabsNav conteo={contarPorTab(rows)}/></Tabs></MemoryRouter>);
 const tab=screen.getByRole('tab',{name:/Notas de Crédito y Débito.*15/});fireEvent.mouseDown(tab,{button:0,ctrlKey:false});fireEvent.click(tab);expect(navegar).toHaveBeenCalledWith('/invoices/notas');
});
it('tarjeta admite el contrato anterior sin los campos opcionales nuevos',()=>{
 const r={...calcularResumenFiscal([]),icbper:undefined,incertidumbre:undefined,bloqueadosLocalmente:undefined,rechazosSunat:undefined,rechazosSinOrigen:undefined};render(<InvoiceKpiCards resumen={r}/>);expect(screen.queryByText(/ICBPER/)).toBeNull();
});
it('la base e IGV sin notas corresponden al mismo bruto que el ICBPER',()=>{
 const factura={...c,importesBandeja:{base:100,igv:18,icbper:.5,total:118.5,verificado:true},totalNeto:118.5};const nota={...c,tipo:'07' as const,baseImponible:500,igv:90,totalNeto:590};
 expect(calcularResumenFiscal(porApartado([factura,nota],'comprobantes'))).toMatchObject({baseTotal:100,igvTotal:18,totalFacturado:118.5,icbper:.5,netoTotalCobrar:118.5});
 expect(calcularResumenFiscal([factura,nota]).netoTotalCobrar).toBe(-471.5);
});
