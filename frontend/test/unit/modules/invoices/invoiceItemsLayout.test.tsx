import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { actualizarItem, calcularItem, itemVacio, valorUnitarioDesdePrecioConIgv } from '@/modules/invoices/lib/invoiceItems';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';

afterEach(cleanup);
const props = () => ({ onCambiar: vi.fn(), onEliminar: vi.fn(), onAgregar: vi.fn(), onAgregarBolsa: vi.fn() });

describe('presentación del detalle de líneas', () => {
  it('distribuye los campos con etiquetas visibles en bloques adaptables', () => {
    render(<InvoiceItemsGrid items={[itemVacio('a')]} {...props()} />);
    const region = screen.getByRole('region', { name: 'Líneas del comprobante' });
    const table = screen.getByRole('table');
    expect(region.contains(table)).toBe(true);
    expect(region.className).not.toContain('overflow-x');
    expect(region.tabIndex).toBe(0);
    expect(table.className).not.toContain('min-w-');
    expect(screen.getByLabelText('Cantidad de la línea 1').closest('tr')?.className).toContain('grid-cols-1');
    expect(table.querySelectorAll('tbody td > span:first-child')).toHaveLength(11);
    expect(table.querySelectorAll('thead')).toHaveLength(1);
    expect(table.querySelectorAll('tbody')).toHaveLength(1);
    expect(screen.getByLabelText('Valor unitario de la línea 1').closest('tr')?.className).toContain('grid');
  });

  it('coloca el aviso de valor cero bajo su fila y abarca todas las columnas', () => {
    render(<InvoiceItemsGrid items={[itemVacio('a'), { ...itemVacio('b'), valorUnitario: 20 }]} {...props()} />);
    const aviso = screen.getByText(/El valor unitario de una línea onerosa debe ser mayor que cero/);
    const celda = aviso.closest('td');
    expect(celda?.colSpan).toBe(11);
    expect(celda?.querySelector('input')).toBeNull();
    expect(celda?.parentElement?.previousElementSibling?.contains(screen.getByLabelText('Valor unitario de la línea 1'))).toBe(true);
    expect(screen.getByLabelText('Valor unitario de la línea 2').closest('tr')?.contains(aviso)).toBe(false);
  });

  it('conserva textos, condiciones del aviso y callbacks de edición', () => {
    const callbacks = props();
    render(<InvoiceItemsGrid items={[{ ...itemVacio('a'), afectacion: 'GRATUITA' }]} {...callbacks} />);
    expect(screen.queryByText(/El valor unitario de una línea onerosa debe ser mayor que cero/)).toBeNull();
    expect(screen.getByRole('option', { name: 'Sin descuento' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '21 - Exonerado - Transferencia gratuita' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '25' } });
    expect(callbacks.onCambiar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la línea 1' }));
    expect(callbacks.onEliminar).toHaveBeenCalledWith(0);
  });
  it('explicita valor sin IGV y conserva la conversión inversa del precio final', () => {
    render(<InvoiceItemsGrid items={[itemVacio('a')]} {...props()} />);
    expect(screen.getByRole('columnheader', { name: /Valor unitario \(sin IGV\)/i })).toBeTruthy();
    expect(screen.getAllByText(/Valor unitario.*sin IGV/i).length).toBeGreaterThan(0);

    expect(valorUnitarioDesdePrecioConIgv(118, 'GRAVADA')).toBe(100);
    expect(valorUnitarioDesdePrecioConIgv(50, 'EXONERADA')).toBe(50);

    const actualizados = actualizarItem([itemVacio('a')], 0, {
      descripcion: 'Taladro percutor',
      cantidad: 2,
      precioUnitario: 118,
    });
    expect(actualizados[0].precioUnitario).toBe(118);
    expect(actualizados[0].valorUnitario).toBe(100);
    expect(calcularItem(actualizados[0])).toEqual({
      base: 200,
      igv: 36,
      icbper: 0,
      total: 236,
    });

    const payload = borradorAPayloadEmision({
      ...borradorInicial('01', '2026-11-07'),
      items: actualizados,
    });
    expect(payload.items[0].precioUnitario).toBe(118);
    expect(payload.items[0].valorUnitario).toBe(100);
  });

  it('elimina una línea cuando queda otra en el detalle', () => {
    const callbacks = props();
    render(<InvoiceItemsGrid items={[itemVacio('a'), itemVacio('b')]} {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la línea 1' }));
    expect(callbacks.onEliminar).toHaveBeenCalledWith(0);
    expect(screen.queryByText('Debe quedar al menos una línea')).toBeNull();
  });
});
