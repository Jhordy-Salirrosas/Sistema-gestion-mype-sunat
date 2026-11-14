import { fireEvent, screen } from '@testing-library/react';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';

/** Línea explícita para pruebas de cálculo; el formulario real comienza sin líneas. */
export const borradorConLinea = (...args: Parameters<typeof borradorInicial>) => ({
  ...borradorInicial(...args), items: [itemVacio('fixture')],
});

/** Selección real de catálogo para pruebas de emisión sin altas libres. */
export async function seleccionarProductoPrueba(sku = 'SERV') {
  const buscador = await screen.findByLabelText('Buscar producto');
  fireEvent.change(buscador, { target: { value: sku } });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(sku + ' ·') }));
}
