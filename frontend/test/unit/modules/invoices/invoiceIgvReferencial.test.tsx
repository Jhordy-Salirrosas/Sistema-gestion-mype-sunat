import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { igvReferencialGratuito } from '@/modules/invoices/lib/invoiceIgvReferencial';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { InvoiceEmitResumen } from '@/modules/invoices/components/InvoiceEmitResumen';
afterEach(cleanup);
const gratuita = { ...itemVacio('g'), afectacion: 'GRATUITA' as const, codigoAfectacion: '11', cantidad: 2, valorUnitario: 35, precioUnitario: 0 };
it.each(['11','12','13','14','15','16','17'])('calcula IGV referencial para motivo %s', codigoAfectacion => {
 expect(igvReferencialGratuito([{...gratuita, codigoAfectacion}])).toBe(12.6);
});
it('excluye gratuitas no gravadas, motivo ausente y operaciones onerosas', () => {
 expect(igvReferencialGratuito([...['21','31',undefined].map(codigoAfectacion=>({...gratuita,codigoAfectacion})),{...gratuita,afectacion:'GRAVADA'}])).toBe(0);
 expect(igvReferencialGratuito([])).toBe(0);
});
it('redondea por línea y suma sin alterar el importe del modal', () => {
 const b = {...borradorInicial('01','2026-11-13'),items:[gratuita]};
 render(<InvoiceEmitResumen borrador={b}/>);
 expect(screen.getByText('IGV referencial de operaciones gratuitas S/ 12.60 (no se cobra)')).toBeTruthy();
 expect(screen.getByText('Importe total S/ 0.00')).toBeTruthy();
});
it('no muestra referencia cuando no hay IGV gratuito',()=>{
 render(<InvoiceEmitResumen borrador={{...borradorInicial('01','2026-11-13'),items:[{...gratuita,codigoAfectacion:'31'}]}}/>);
 expect(screen.queryByText(/IGV referencial/)).toBeNull();
});
