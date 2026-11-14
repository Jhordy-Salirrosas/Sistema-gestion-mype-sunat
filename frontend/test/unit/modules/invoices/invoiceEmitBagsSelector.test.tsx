import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
afterEach(cleanup);
it('el selector de bolsas lleva a la cantidad de su línea sin agregar bolsas ni líneas', () => {
  const items = ['P1', 'P2'].map((sku, i) => itemDesdeProducto({ sku, descripcion: `Producto ${i}`, unidad: 'NIU', valorUnitario: 100, afectacion: '10' }, sku));
  const onCambiar = vi.fn(), onAgregarBolsa = vi.fn();
  render(<InvoiceItemsGrid items={items} onCambiar={onCambiar} onEliminar={vi.fn()} onAgregarBolsa={onAgregarBolsa} />);
  expect(screen.queryByRole('button', { name: /Bolsa plástica/ })).toBeNull();
  fireEvent.change(screen.getByLabelText('Producto para bolsas'), { target: { value: 'P2' } });
  expect(document.activeElement).toBe(screen.getByLabelText('ICBPER de la línea 2'));
  expect(onAgregarBolsa).not.toHaveBeenCalled();expect(onCambiar).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('ICBPER de la línea 2'), { target: { value: '3' } });
  expect(onCambiar).toHaveBeenCalledWith(1, { cantidadBolsas: 3 });
});
