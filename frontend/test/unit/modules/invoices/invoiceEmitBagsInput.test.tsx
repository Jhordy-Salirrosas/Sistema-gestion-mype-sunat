import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { actualizarItem, itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
afterEach(cleanup);
it('bolsas rechaza decimales pegados sin modificar el impuesto y acepta cero y enteros', () => {
  function Form() {
    const [items, setItems] = useState([itemDesdeProducto({ sku: 'P', descripcion: 'Producto', unidad: 'NIU', valorUnitario: 100, afectacion: '10' }, 'p')]);
    return <><InvoiceItemsGrid items={items} onCambiar={(i, p) => setItems(v => [...actualizarItem(v, i, p)])} onEliminar={vi.fn()} />
      <output aria-label="Impuesto bolsas">{items[0].icbper}</output></>;
  }
  render(<Form />);
  const campo = screen.getByLabelText('ICBPER de la línea 1') as HTMLInputElement;
  expect(campo.inputMode).toBe('numeric');
  for (const value of ['2.333', '-1', '1e2', '2,5']) {
    fireEvent.change(campo, { target: { value } });
    expect(campo.value).toBe('0');
    expect(screen.getByLabelText('Impuesto bolsas').textContent).toBe('0');
  }
  fireEvent.change(campo, { target: { value: '03' } });
  expect(campo.value).toBe('3');
  expect(screen.getByLabelText('Impuesto bolsas').textContent).toBe('1.5');
  fireEvent.change(campo, { target: { value: '0' } });
  expect(campo.value).toBe('0');
  expect(campo.getAttribute('aria-invalid')).toBe('false');
});
