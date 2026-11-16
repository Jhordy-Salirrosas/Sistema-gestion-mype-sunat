import { InvoiceAccountingBridgeService } from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
import { CollectionsService } from '../../../src/modules/collections/application/services/collectionsService';
function setup() {
 let exists=false;const receipts=new Map();
 const db={accountingEntry:{findFirst:jest.fn(async()=>exists?{id:'entry'}:null)},
  accountingRule:{findMany:jest.fn(async({where}:any)=>where.process_code==='COBRO'?[{line_order:1,account_code:'1041'}]:[{line_order:1,account_code:'12121'},{line_order:2,account_code:'40111'},{line_order:3,account_code:'70121'}])},
  accountingMapping:{findMany:jest.fn(async()=>[])},collection:{upsert:jest.fn(async({where,create}:any)=>{if(!receipts.has(where.id))receipts.set(where.id,create);return receipts.get(where.id);})}};
 const execute=jest.fn(async()=>{exists=true;return{id:'entry'};});
 const bridge=new InvoiceAccountingBridgeService(db as never,{execute:jest.fn()} as never,{execute} as never);
 const invoice:any={id:'invoice',companyId:'company',tipoComprobante:'01',serie:'F001',correlativo:1,fechaEmision:'2026-11-16',items:[],importes:{gravado:100,igv:18,exonerado:0,inafecto:0,icbper:0,detraccion:0,retencion:0,total:118},cliente:{razonSocial:'Cliente',numeroDocumento:'20100070970'}};
 return{bridge,db,execute,receipts,invoice};
}
it.each([['EFECTIVO','1011'],['YAPE','1041'],['PLIN','1041'],['TARJETA','1041'],['TRANSFERENCIA','1041']])('puente %s asienta %s y reprocesa sin duplicar cobro/asiento',async(medio,account)=>{
 const h=setup();h.invoice.pago={version:1,forma:'Contado',medio};
 expect((await h.bridge.registrar(h.invoice)).completo).toBe(true);expect((await h.bridge.registrar(h.invoice)).completo).toBe(true);
 expect(h.execute).toHaveBeenCalledTimes(1);expect(h.execute.mock.calls[0][0]).toMatchObject({lines:expect.arrayContaining([expect.objectContaining({accountCode:account,debitAmount:118})])});expect(h.receipts.size).toBe(1);expect(h.receipts.get('m1-cash:invoice')).toMatchObject({amount:118,payment_method:medio,invoice_id:'invoice'});
});
it.each([undefined,{version:1,forma:'Credito',medio:'YAPE'}])('histórico y crédito conservan CXC y no generan cobro automático',async pago=>{
 const h=setup();h.invoice.pago=pago;await h.bridge.registrar(h.invoice);expect(h.execute.mock.calls[0][0]).toMatchObject({lines:expect.arrayContaining([expect.objectContaining({accountCode:'12121'})])});expect(h.receipts.size).toBe(0);
});
it('recupera cobro fallido aunque el asiento ya exista',async()=>{const h=setup();h.invoice.pago={version:1,forma:'Contado',medio:'EFECTIVO'};h.db.collection.upsert.mockRejectedValueOnce(new Error('local'));expect((await h.bridge.registrar(h.invoice)).completo).toBe(false);expect((await h.bridge.registrar(h.invoice)).completo).toBe(true);expect(h.execute).toHaveBeenCalledTimes(1);expect(h.receipts.size).toBe(1);});
it('el cobro automático solo se cancela tras anulación fiscal, sin reverso contable duplicado',async()=>{
 const db={collection:{findFirst:jest.fn(async()=>({id:'m1-cash:invoice',invoice_id:'invoice',status:'REGISTRADO'})),update:jest.fn(async()=>({status:'ANULADO'}))},invoice:{findFirst:jest.fn().mockResolvedValueOnce({estado:'ACEPTADO'}).mockResolvedValueOnce({estado:'ANULADO'})}};
 const svc=new CollectionsService(db as never,{} as never);await expect(svc.annul('company','m1-cash:invoice')).rejects.toThrow('Anule primero');expect(await svc.annul('company','m1-cash:invoice')).toEqual({status:'ANULADO'});
});
it('POS anterior espera al puente y luego recibe el mismo cobro sin crear otro asiento',async()=>{
 const receipt={id:'m1-cash:invoice',amount:118,payment_method:'EFECTIVO'};
 const db={invoice:{findFirst:jest.fn(async()=>({id:'invoice',monto_total:118,estado:'ACEPTADO',payload_ubl:{m1PaymentAccountingVersion:1,formaPago:'Contado',medioPago:'EFECTIVO'}}))},collection:{findFirst:jest.fn().mockResolvedValueOnce(null).mockResolvedValue(receipt),create:jest.fn()}};
 const execute=jest.fn();const service=new CollectionsService(db as never,{execute} as never);const dto={customerName:'Cliente',invoiceNumber:'F001-00000001',amount:118,paymentMethod:'EFECTIVO'};
 await expect(service.create('company',dto)).rejects.toThrow('puente');expect(await service.create('company',dto)).toBe(receipt);expect(db.collection.create).not.toHaveBeenCalled();expect(execute).not.toHaveBeenCalled();
});
it('un cobro automático no admite otro importe ni medio a través de cobranzas',async()=>{
 const db={invoice:{findFirst:jest.fn(async()=>({id:'invoice',monto_total:118,estado:'ACEPTADO',payload_ubl:{m1PaymentAccountingVersion:1,formaPago:'Contado',medioPago:'EFECTIVO'}}))},collection:{findFirst:jest.fn(async()=>({id:'m1-cash:invoice',amount:118,payment_method:'EFECTIVO'}))}};
 const service=new CollectionsService(db as never,{} as never);for(const detail of [{amount:1,paymentMethod:'EFECTIVO'},{amount:118,paymentMethod:'YAPE'}])await expect(service.create('company',{customerName:'Cliente',invoiceNumber:'F001-1',...detail})).rejects.toThrow('no coincide');
});
