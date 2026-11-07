import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';

afterEach(cleanup);
const props = () => ({ onCambiar: vi.fn(), onEliminar: vi.fn(), onAgregar: vi.fn(), onAgregarBolsa: vi.fn() });

describe('presentación del detalle de líneas', () => {
  it('mantiene cabecera y cuerpo en una única tabla con desplazamiento y anchos reservados', () => {
    render(<InvoiceItemsGrid items={[itemVacio('a')]} {...props()} />);
    const region = screen.getByRole('region', { name: 'Líneas del comprobante' });
    const table = screen.getByRole('table');
    expect(region.contains(table)).toBe(true);
    expect(region.className).toContain('overflow-x-auto');
    expect(region.tabIndex).toBe(0);
    expect(table.className).toContain('min-w-[1768px]');
    expect(table.className).toContain('table-fixed');
    expect(table.querySelectorAll('col')).toHaveLength(11);
    expect(table.querySelectorAll('thead')).toHaveLength(1);
    expect(table.querySelectorAll('tbody')).toHaveLength(1);
    expect(screen.getByLabelText('Valor unitario de la línea 1').closest('tr')?.className).toContain('align-top');
  });

  it('coloca el aviso de valor cero bajo su fila y abarca todas las columnas', () => {
    render(<InvoiceItemsGrid items={[itemVacio('a'), { ...itemVacio('b'), valorUnitario: 20 }]} {...props()} />);
    const aviso = screen.getByText(/El valor unitario es cero/);
    const celda = aviso.closest('td');
    expect(celda?.colSpan).toBe(11);
    expect(celda?.querySelector('input')).toBeNull();
    expect(celda?.parentElement?.previousElementSibling?.contains(screen.getByLabelText('Valor unitario de la línea 1'))).toBe(true);
    expect(screen.getByLabelText('Valor unitario de la línea 2').closest('tr')?.contains(aviso)).toBe(false);
  });

  it('conserva textos, condiciones del aviso y callbacks de edición', () => {
    const callbacks = props();
    render(<InvoiceItemsGrid items={[{ ...itemVacio('a'), afectacion: 'GRATUITA' }]} {...callbacks} />);
    expect(screen.queryByText(/El valor unitario es cero/)).toBeNull();
    expect(screen.getByRole('option', { name: 'Sin descuento' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '10 - Gravada onerosa (tributo 1000 - IGV)' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '25' } });
    expect(callbacks.onCambiar).toHaveBeenCalledWith(0, { valorUnitario: 25 });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la línea 1' }));
    expect(callbacks.onEliminar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Debe quedar al menos una línea');
  });
  it('elimina una línea cuando queda otra en el detalle', () => {
    const callbacks = props();
    render(<InvoiceItemsGrid items={[itemVacio('a'), itemVacio('b')]} {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la línea 1' }));
    expect(callbacks.onEliminar).toHaveBeenCalledWith(0);
    expect(screen.queryByText('Debe quedar al menos una línea')).toBeNull();
  });
});
