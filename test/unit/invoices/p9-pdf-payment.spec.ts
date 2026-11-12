import { InvoiceDownloadService } from '../../../src/modules/invoices/application/services/invoiceDownloadService';
it.each([true,false])('PDF transporta cronograma y cuenta BN disponibles=%s',async present=>{
 const service=Object.create(InvoiceDownloadService.prototype);service.qr={generarPng:jest.fn()};
 const cuotas=[{numero:'Cuota001',monto:118,vencimiento:'2026-12-01'}];
 const fila={items:[],payload_ubl:present?{cuotas,cuentaBancoNacion:'00012345678'}:{},fecha_emision:new Date('2026-11-12'),monto_total:118};
 const data=await service.datosPdf(fila);
 expect(data.cuotas).toEqual(present?cuotas:[]);expect(data.cuentaBancoNacion).toBe(present?'00012345678':undefined);
});
