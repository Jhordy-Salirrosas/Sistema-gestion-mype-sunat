import { InvoiceQueryService } from '../../../src/modules/invoices/application/services/invoiceQueryService';
it('C2 RECHAZADO informa estado final sin publicar, tocar incertidumbre ni abrir una reapertura',async()=>{
 const db={invoice:{findFirst:jest.fn(async()=>({id:'i',estado:'RECHAZADO'})),updateMany:jest.fn()},auditLog:{create:jest.fn()}};
 const queue={reenqueueInvoiceIfIdle:jest.fn(),enqueueInvoiceInTx:jest.fn()};
 expect(await new InvoiceQueryService(db as never,queue as never).reintentarCdr('c','i')).toMatchObject({encolado:false,codigo:'INVOICE_REJECTED_FINAL',resultadoCola:'ESTADO_NO_PERMITIDO',mensaje:expect.stringContaining('No se reencola')});
 expect(queue.reenqueueInvoiceIfIdle).not.toHaveBeenCalled();expect(queue.enqueueInvoiceInTx).not.toHaveBeenCalled();expect(db.invoice.updateMany).not.toHaveBeenCalled();
});
it.each(['ERROR_RED','ENVIADO'])('C2 mantiene el reintento de %s',async estado=>{
 const db={invoice:{findFirst:jest.fn(async()=>({id:'i',estado})),findUnique:jest.fn(async()=>({estado})),updateMany:jest.fn(async()=>({count:0}))},auditLog:{create:jest.fn()}};
 const queue={reenqueueInvoiceIfIdle:jest.fn(async(_id,_company,allowed)=>({estado:await allowed()?'ENCOLADO':'ESTADO_NO_PERMITIDO'}))};
 expect(await new InvoiceQueryService(db as never,queue as never).reintentarCdr('c','i')).toMatchObject({encolado:true});
});
