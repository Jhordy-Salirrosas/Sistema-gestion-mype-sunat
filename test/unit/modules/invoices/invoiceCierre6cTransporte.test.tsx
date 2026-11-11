import { it,expect,afterEach } from 'vitest';
import { render,screen,cleanup } from '@testing-library/react';
import { InvoiceTable } from '@/modules/invoices/components/InvoiceTable';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
afterEach(cleanup);
it.each([false,true,undefined])('acción CDR solo con transporte acreditado %s',acreditado=>{
 const c=aComprobanteDemo(aInvoice({id:'nd',tipo_comprobante:'08',serie:'FD01',correlativo:acreditado?2:1,numero:'FD01-00000001',fecha_emision:'2026-11-10',estado:'RECHAZADO',monto_total:118,moneda:'PEN',cliente_documento:'20100070970',cliente_nombre:'Cliente',cdr_codigo:null,transporte_acreditado:acreditado}));
 render(<InvoiceTable comprobantes={[c]} onVerXml={()=>{}} onVerCdr={()=>{}} onDescargarPdf={()=>{}} onReintentarCdr={()=>{}}/>);
 expect(Boolean(screen.queryByRole('button',{name:/Reintentar CDR/}))).toBe(acreditado===true);
});
