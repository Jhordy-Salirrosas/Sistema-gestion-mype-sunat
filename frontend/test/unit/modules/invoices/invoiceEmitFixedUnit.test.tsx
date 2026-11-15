import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
afterEach(cleanup);
it('muestra la unidad del producto como dato fijo sin selector ni mutación', () => {
  const onCambiar = vi.fn();
  render(<InvoiceItemsGrid items={[itemDesdeProducto({ sku: 'P', descripcion: 'Producto', unidad: 'KGM', valorUnitario: 100, afectacion: '10' }, 'p')]}
    onCambiar={onCambiar} onEliminar={vi.fn()} />);
  const unidad = screen.getByLabelText('Unidad de la línea 1');
  expect(unidad.tagName).toBe('SPAN');
  expect(unidad.textContent).toBe('KGM');
  expect(onCambiar).not.toHaveBeenCalled();
  expect(screen.queryByRole('combobox', { name: 'Unidad de la línea 1' })).toBeNull();
});
