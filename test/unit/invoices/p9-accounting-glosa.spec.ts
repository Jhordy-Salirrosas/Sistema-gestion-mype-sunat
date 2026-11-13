import { InvoiceAccountingBridgeService } from '../../../src/modules/invoices/application/services/invoiceAccountingBridgeService';
it.each([['01','Venta'],['03','Venta'],['07','Reverso de venta'],['08','Cargo']])('glosa %s describe %s',(tipo,glosa)=>{
 const service=Object.create(InvoiceAccountingBridgeService.prototype);
 expect(service.glosaDe({tipoComprobante:tipo,cliente:{razonSocial:'Cliente'}},'FD01-1')).toBe(`${glosa} según FD01-1 a Cliente`);
});
