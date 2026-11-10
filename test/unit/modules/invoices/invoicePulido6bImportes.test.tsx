import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
import { InvoiceTable } from '@/modules/invoices/components/InvoiceTable';
it('transporta persistidos por normalizador y adaptador hasta la celda', () => {
 const dto = { id: 'inv', tipo_comprobante: '01', serie: 'F001', correlativo: 66, numero: 'F001-00000066', fecha_emision: '2026-11-10', estado: 'ACEPTADO', monto_total: 730.17, moneda: 'PEN', cliente_documento: '20100070970', cliente_nombre: 'Cliente', cdr_codigo: '0', monto_detraccion: 73.02, monto_retencion: 12.34 };
 const normalizado = aInvoice(dto);
 expect(normalizado.montoDetraccion).toBe(73.02);
 const c = aComprobanteDemo(normalizado);
 expect(c).toMatchObject({ detraccion: 73.02, retencion: 12.34, totalNeto: 730.17 });
 expect(aComprobanteDemo(dto)).toMatchObject({ detraccion: 73.02, retencion: 12.34 });
 render(<InvoiceTable comprobantes={[c]} onVerXml={() => {}} onVerCdr={() => {}} onDescargarPdf={() => {}} onReintentarCdr={() => {}} />);
 expect(screen.getByText(/Detracción.*73[.,]02/)).toBeTruthy();
 expect(screen.getByText(/Retención.*12[.,]34/)).toBeTruthy();
});
