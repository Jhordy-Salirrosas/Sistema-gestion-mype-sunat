import { igvReferencialGratuito } from '@/modules/invoices/lib/invoiceIgvReferencial';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
import { cleanup } from '@testing-library/react';
import { afterEach,expect,it } from 'vitest';
afterEach(cleanup);
const gratuita = { ...itemVacio('g'), afectacion: 'GRATUITA' as const, codigoAfectacion: '11', cantidad: 2, valorUnitario: 35, precioUnitario: 0 };
it.each(['11','12','13','14','15','16','17'])('calcula IGV referencial para motivo %s', codigoAfectacion => {
 expect(igvReferencialGratuito([{...gratuita, codigoAfectacion}])).toBe(12.6);
});
it('excluye gratuitas no gravadas, motivo ausente y operaciones onerosas', () => {
 expect(igvReferencialGratuito([...['21','31',undefined].map(codigoAfectacion=>({...gratuita,codigoAfectacion})),{...gratuita,afectacion:'GRAVADA'}])).toBe(0);
 expect(igvReferencialGratuito([])).toBe(0);
});
