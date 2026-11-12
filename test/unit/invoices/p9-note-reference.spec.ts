import { bloqueReferenciaNota } from '../../../src/modules/invoices/xmlNodesHelper';
import { InvoiceJobConsumer } from '../../../src/modules/invoices/invoiceJobConsumer';
it.each([['F001-1',undefined,'01'],['B001-1',undefined,'03'],['F001-1','03','03'],['B001-1','01','01'],['B001-1','invalid','03']])('BillingReference %s con fuente %s usa %s',(number,type,expected)=>{
 expect(bloqueReferenciaNota(number,'01','Motivo',type)).toContain(`<cbc:DocumentTypeCode>${expected}</cbc:DocumentTypeCode>`);
});
it.each([['03','01','03'],[null,'01','01']])('worker prefiere el tipo persistido %s al payload %s', (stored,payload,expected)=>{
 const consumer=Object.create(InvoiceJobConsumer.prototype);
 consumer.ublGenerator={generateInvoiceXml:jest.fn(()=>'<Note/>')};consumer.xsdValidator={validateInvoiceUbl21:()=>({isValid:true})};
 expect(consumer.xmlDelComprobante({id:'n',payload_ubl:{referenced_document_type:payload},referenced_document_type:stored})).toBe('<Note/>');
 expect(consumer.ublGenerator.generateInvoiceXml).toHaveBeenCalledWith({referenced_document_type:expected});
});
