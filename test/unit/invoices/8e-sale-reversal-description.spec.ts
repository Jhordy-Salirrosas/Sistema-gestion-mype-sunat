import {InvoiceAccountingBridgeService, type FacturaParaPuente} from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
function setup(tipo='07',nombre: string|undefined='Cliente ficticio',existente=false){
 const execute=jest.fn(async()=>({id:'asiento-nuevo'}));
 const db={accountingEntry:{findFirst:jest.fn(async()=>existente?{id:'63'}:null)},accountingRule:{findMany:jest.fn(async()=>[{line_order:1,account_code:'121210'},{line_order:2,account_code:'401110'},{line_order:3,account_code:'701210'}])},accountingMapping:{findMany:jest.fn(async()=>[])}};
 const service=new InvoiceAccountingBridgeService(db as never,{} as never,{execute} as never);
 const factura:FacturaParaPuente={id:'invoice',companyId:'company',tipoComprobante:tipo,serie:tipo==='07'?'FC01':'F001',correlativo:18,fechaEmision:'2026-11-11',cliente:{razonSocial:nombre},items:[],motivoNota:'03',importes:{gravado:100,igv:18,exonerado:0,inafecto:0,icbper:0,total:118,detraccion:0,retencion:0}};
 return {service,execute,factura};
}
it.each(['01','03','07','08'])('E2: glosa del asiento creado, tipo %s',async tipo=>{const h=setup(tipo);await h.service.registrar(h.factura);expect(h.execute).toHaveBeenCalledWith(expect.objectContaining({glosa:`${tipo==='07'?'Reverso de venta':'Venta'} según ${tipo==='07'?'FC01':'F001'}-00000018 a Cliente ficticio`}));});
it('conserva el fallback de cliente',async()=>{const h=setup('07','   ');await h.service.registrar(h.factura);expect(h.execute).toHaveBeenCalledWith(expect.objectContaining({glosa:'Reverso de venta según FC01-00000018 a cliente'}));});
it('conserva el máximo de 200 caracteres con elipsis',async()=>{const h=setup('07','X'.repeat(300));await h.service.registrar(h.factura);const glosa=(h.execute.mock.calls[0] as unknown as [{glosa:string}])[0].glosa;expect(glosa).toHaveLength(200);expect(glosa.endsWith('...')).toBe(true);});
it('un asiento histórico existente no se renombra ni se vuelve a generar',async()=>{const h=setup('07','Cliente ficticio',true);expect(await h.service.registrar(h.factura)).toMatchObject({asientoId:'63',asientoOmitido:true});expect(h.execute).not.toHaveBeenCalled();});
