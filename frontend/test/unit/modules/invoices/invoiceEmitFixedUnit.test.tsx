import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
afterEach(cleanup);
it('muestra la unidad del producto como dato fijo sin selector ni mutación', () => {
  const onCambiar = vi.fn();
  render(<InvoiceItemsGrid items={[itemDesdeProducto({ sku: 'P', descripcion: 'Producto', unidad: 'KGM', valorUnitario: 100, afectacion: '10' }, 'p')]}
    onCambiar={onCambiar} onEliminar={vi.fn()} />);
  const unidad = screen.getByLabelText('Unidad de la línea 1') as HTMLInputElement;
  expect(unidad.tagName).toBe('INPUT');
  expect(unidad.readOnly).toBe(true);
  expect(unidad.value).toBe('KGM');
  fireEvent.change(unidad, { target: { value: 'NIU' } });
  expect(onCambiar).not.toHaveBeenCalled();
  expect(screen.queryByRole('combobox', { name: 'Unidad de la línea 1' })).toBeNull();
});
