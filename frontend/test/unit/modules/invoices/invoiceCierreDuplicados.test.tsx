import { it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { itemDesdeProducto } from '@/modules/invoices/lib/invoiceItems';
const p = { sku: 'ARE', descripcion: 'Arena', unidad: 'MTQ', afectacion: '10', precioUnitario: 118, valorUnitario: 100 };
afterEach(cleanup);
it.each(['Fusionar cantidades', 'Mantener separada', 'Cancelar'])('6C selección duplicada exige decidir %s', action => {
 const cambiar = vi.fn(), agregar = vi.fn();
 render(<InvoiceItemsGrid items={[{ ...itemDesdeProducto(p, '1'), cantidad: 2 }]} productos={[p]} onCambiar={cambiar} onEliminar={vi.fn()} onAgregar={vi.fn()} onAgregarBolsa={vi.fn()} onAgregarConProducto={agregar} />);
 fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'ARE' } }); fireEvent.click(screen.getByRole('button', { name: /ARE · Arena/ }));
 expect(agregar).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: action }));
 if (action === 'Fusionar cantidades') expect(cambiar).toHaveBeenCalledWith(0, { cantidad: 3 }); else expect(cambiar).not.toHaveBeenCalled();
 expect(agregar).toHaveBeenCalledTimes(action === 'Mantener separada' ? 1 : 0);
});
it('6C precio distinto impide fusión y permite solo separación expresa', () => {
 render(<InvoiceItemsGrid items={[{ ...itemDesdeProducto(p, '1'), precioUnitario: 120 }]} productos={[p]} onCambiar={vi.fn()} onEliminar={vi.fn()} onAgregar={vi.fn()} onAgregarBolsa={vi.fn()} onAgregarConProducto={vi.fn()} />);
 fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'ARE' } }); fireEvent.click(screen.getByRole('button', { name: /ARE · Arena/ }));
 expect((screen.getByRole('button', { name: 'Fusionar cantidades' }) as HTMLButtonElement).disabled).toBe(true);
});

it('6C selección repetida pide decisión y valida stock agregado al fusionar', async () => {
 const { useState } = await import('react');
 function Form() { const [items, setItems] = useState([{ ...itemDesdeProducto(p, '1'), cantidad: 2 }]);
 return <InvoiceItemsGrid items={items} productos={[{ ...p, stock: 2 }]} onCambiar={(i, patch) => setItems(prev => prev.map((x,n) => n === i ? { ...x, ...patch } : x))} onEliminar={vi.fn()} onAgregarConProducto={vi.fn()} />; }
 render(<Form />);
 fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'ARE' } }); fireEvent.click(screen.getByRole('button', { name: /ARE · Arena/ }));
 expect(screen.getByRole('dialog')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Fusionar cantidades' }));
 expect((screen.getByLabelText('Cantidad de la línea 1') as HTMLInputElement).value).toBe('3');
 expect(screen.getAllByText(/stock|disponible/i).length).toBeGreaterThan(0);
});
