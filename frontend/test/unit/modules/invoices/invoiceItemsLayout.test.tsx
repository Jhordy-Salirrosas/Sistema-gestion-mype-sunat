import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { actualizarItem, calcularItem, itemVacio, valorUnitarioDesdePrecioConIgv } from '@/modules/invoices/lib/invoiceItems';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';

afterEach(cleanup);
const props = () => ({ onCambiar: vi.fn(), onEliminar: vi.fn(), onAgregar: vi.fn(), onAgregarBolsa: vi.fn() });

describe('presentación del detalle de líneas', () => {
  it('usa tarjetas de tres filas bajo 1000px y conserva la tabla de una fila desde 1000px', () => {
    render(<InvoiceItemsGrid items={[itemVacio('a')]} {...props()} />);
    const region = screen.getByRole('region', { name: 'Líneas del comprobante' });
    const table = screen.getByRole('table');
    expect(region.contains(table)).toBe(true);
    expect(region.className).toContain('overflow-x-hidden');
    expect(region.tabIndex).toBe(0);
    const header = table.querySelector('thead tr')!;
    const row = screen.getByLabelText('Cantidad de la línea 1').closest('tr')!;
    expect(row.className).toContain('grid-cols-16');
    expect(row.className).not.toContain('grid-cols-12');
    expect(row.className).toContain('rounded-lg');
    expect(header.parentElement?.className).toContain('hidden');
    expect(header.parentElement?.className).toContain('@min-[1000px]/items:block');
    expect(row.className).toContain('@min-[1000px]/items:grid-cols-');
    expect([...header.classList].find(c => c.startsWith('@min-[1000px]/items:grid-cols-'))).toBe([...row.classList].find(c => c.startsWith('@min-[1000px]/items:grid-cols-')));
    expect(Array.from(table.querySelectorAll('th'), cell => cell.textContent)).toEqual(['Producto', 'Cant.', 'V.U.', 'Desc. Cat. 53', 'Bolsas', 'Afectación', 'Detracción', 'Total', '']);
    expect(row.querySelectorAll('td')).toHaveLength(9);
    for (const label of ['Cant.', 'V.U.', 'Desc. Cat. 53', 'Bolsas', 'Afectación', 'Detracción']) {
      expect(within(row).getByText(label).className).toContain('@min-[1000px]/items:hidden');
    }
    const positions = [[11,1,1],[4,1,2],[4,5,2],[4,9,2],[4,13,2],[12,1,3],[4,13,3],[3,12,1],[2,15,1]];
    Array.from(row.querySelectorAll('td')).forEach((cell, i) => {
      const [span, col, band] = positions[i];
      expect(cell.classList).toContain(`col-span-${span}`);
      expect(cell.classList).toContain(`col-start-${col}`);
      expect(cell.classList).toContain(`row-start-${band}`);
      expect(cell.classList).toContain('@min-[1000px]/items:col-start-auto');
      expect(cell.classList).toContain('@min-[1000px]/items:row-start-auto');
    });
    expect(screen.getByLabelText('Código de la línea 1').closest('td')).toBe(screen.getByLabelText('Descripción de la línea 1').closest('td'));
    expect(screen.getByLabelText('Unidad de la línea 1').closest('td')).toBe(screen.getByLabelText('Código de la línea 1').closest('td'));
    expect(screen.getByLabelText('Detracción de la línea 1').closest('td')).not.toBe(screen.getByLabelText('Gratuita de la línea 1').closest('td'));
    expect(table.querySelectorAll('thead')).toHaveLength(1);
    expect(table.querySelectorAll('tbody')).toHaveLength(1);
    expect(screen.getByLabelText('Valor unitario de la línea 1').tagName).toBe('SPAN');
  });

  it('mantiene identidad en una línea con el texto completo accesible y total/eliminar a su derecha', () => {
    const descripcion = 'Cemento Portland tipo I con descripción extensa para comprobar elipsis';
    render(<InvoiceItemsGrid items={[{ ...itemVacio('a'), codigo: 'CEM-001', descripcion, unidad: 'NIU', valorUnitario: 35 }]} {...props()} />);
    const sku = screen.getByLabelText('Código de la línea 1');
    const nombre = screen.getByLabelText('Descripción de la línea 1');
    const unidad = screen.getByLabelText('Unidad de la línea 1');
    const identity = sku.closest('[data-invoice-item-identity]')!;
    expect(identity.getAttribute('title')).toBe(`CEM-001 · ${descripcion} · NIU`);
    expect(nombre.textContent?.trim()).toBe(descripcion);
    expect(nombre.getAttribute('title')).toBe(descripcion);
    expect(nombre.className).toContain('truncate');
    expect(identity.contains(unidad)).toBe(true);
    const row = sku.closest('tr')!;
    expect(row.querySelectorAll('td')[7].className).toContain('row-start-1');
    expect(screen.getByRole('button', { name: 'Eliminar la línea 1' }).closest('td')?.className).toContain('row-start-1');
  });

  it('muestra las afectaciones completas y conserva los handlers de cada fila', () => {
    const callbacks = props();
    render(<InvoiceItemsGrid items={[
      { ...itemVacio('a'), codigo: 'P1', descripcion: 'Producto uno', valorUnitario: 100 },
      { ...itemVacio('b'), codigo: 'P2', descripcion: 'Producto dos', valorUnitario: 100, afectacion: 'GRATUITA', codigoAfectacion: '37' },
    ]} {...callbacks} />);
    const fixed = screen.getByLabelText('Afectación de la línea 1');
    expect(fixed.textContent).toContain('10 · Gravado - Operación onerosa · Tributo 1000 - IGV');
    expect(fixed.className).not.toMatch(/truncate|max-w-/);
    const select = screen.getByLabelText('Motivo de gratuidad de la línea 2');
    expect(select.parentElement?.textContent).toContain('37 - Inafecto - Retiro por entrega a trabajadores');
    expect(select.parentElement?.querySelector('span')?.className).toContain('whitespace-normal');
    fireEvent.change(select, { target: { value: '31' } });
    expect(callbacks.onCambiar).toHaveBeenLastCalledWith(1, { codigoAfectacion: '31' });
    fireEvent.change(screen.getByLabelText('Detracción de la línea 1'), { target: { value: '009' } });
    expect(callbacks.onCambiar).toHaveBeenLastCalledWith(0, { codigoDetraccion: '009' });
    expect(screen.getAllByRole('columnheader')).toHaveLength(9);
    expect(screen.getByLabelText('Código de la línea 1').className).toContain('font-semibold');
  });

  it('muestra Bolsas solo en la seleccionada o con cantidad, sin romper el foco del selector', () => {
    const callbacks = props();
    render(<InvoiceItemsGrid items={['P1', 'P2', 'P3'].map((codigo, i) => ({
      ...itemVacio(codigo), codigo, descripcion: codigo, valorUnitario: 100, cantidadBolsas: i === 2 ? 2 : 0, icbper: i === 2 ? 1 : 0,
    }))} {...callbacks} />);
    const first = screen.getByLabelText('ICBPER de la línea 1').closest('[data-bags-visible]')!;
    const second = screen.getByLabelText('ICBPER de la línea 2').closest('[data-bags-visible]')!;
    const third = screen.getByLabelText('ICBPER de la línea 3').closest('[data-bags-visible]')!;
    expect(first.getAttribute('data-bags-visible')).toBe('true');
    expect(second.getAttribute('data-bags-visible')).toBe('false');
    expect(third.getAttribute('data-bags-visible')).toBe('true');
    expect(within(second as HTMLElement).getByText('—')).toBeTruthy();
    expect(screen.getByLabelText('ICBPER de la línea 2').parentElement?.className).toContain('sr-only');
    fireEvent.change(screen.getByLabelText('Producto para bolsas'), { target: { value: 'P2' } });
    expect(document.activeElement).toBe(screen.getByLabelText('ICBPER de la línea 2'));
    expect(first.getAttribute('data-bags-visible')).toBe('false');
    expect(second.getAttribute('data-bags-visible')).toBe('true');
    expect(third.getAttribute('data-bags-visible')).toBe('true');
    expect(callbacks.onCambiar).not.toHaveBeenCalled();
  });

  it('coloca el aviso de valor cero bajo su fila y abarca todas las columnas', () => {
    render(<InvoiceItemsGrid items={[itemVacio('a'), { ...itemVacio('b'), valorUnitario: 20 }]} {...props()} />);
    const aviso = screen.getByText(/El valor unitario de una línea onerosa debe ser mayor que cero/);
    const celda = aviso.closest('td');
    expect(celda?.colSpan).toBe(9);
    expect(celda?.querySelector('input')).toBeNull();
    expect(celda?.parentElement?.previousElementSibling?.contains(screen.getByLabelText('Valor unitario de la línea 1'))).toBe(true);
    expect(screen.getByLabelText('Valor unitario de la línea 2').closest('tr')?.contains(aviso)).toBe(false);
  });

  it('conserva textos, condiciones del aviso y callbacks de edición', () => {
    const callbacks = props();
    render(<InvoiceItemsGrid items={[{ ...itemVacio('a'), afectacion: 'GRATUITA' }]} {...callbacks} />);
    expect(screen.queryByText(/El valor unitario de una línea onerosa debe ser mayor que cero/)).toBeNull();
    expect(screen.getByRole('option', { name: 'Sin desc.' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '21 - Exonerado - Transferencia gratuita' })).toBeTruthy();
    expect(screen.getByLabelText('Valor unitario de la línea 1').tagName).toBe('SPAN');
    expect(callbacks.onCambiar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la línea 1' }));
    expect(callbacks.onEliminar).toHaveBeenCalledWith(0);
  });
  it('explicita valor sin IGV y conserva la conversión inversa del precio final', () => {
    render(<InvoiceItemsGrid items={[itemVacio('a')]} {...props()} />);
    expect(screen.getByRole('columnheader', { name: /Valor unitario \(sin IGV\)/i })).toBeTruthy();
    expect(screen.getByLabelText('Valor unitario de la línea 1').getAttribute('title')).toMatch(/sin IGV/i);

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
