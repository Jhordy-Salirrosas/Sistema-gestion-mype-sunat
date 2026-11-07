import { expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InvoiceItemsGrid } from '@/modules/invoices/components/InvoiceItemsGrid';
import { itemVacio } from '@/modules/invoices/lib/invoiceItems';
it('avisa el valor cero y el descuento que excede la línea', () => {
  const item = { ...itemVacio('a'), descripcion: 'Servicio', descuento: { codigo: '00' as const, monto: 20 } };
  render(<InvoiceItemsGrid items={[item]} onCambiar={vi.fn()} onEliminar={vi.fn()} onAgregar={vi.fn()} onAgregarBolsa={vi.fn()} />);
  expect(screen.getByText(/valor unitario es cero/)).toBeTruthy();
  expect(screen.getByText(/descuento no puede superar/)).toBeTruthy();
  cleanup();
});
it('muestra el aviso condicional de cuenta 74 solo para descuento 01', () => {
  const item = { ...itemVacio('a'), descuento: { codigo: '01' as const, monto: 1 } };
  const props = { onCambiar: vi.fn(), onEliminar: vi.fn(), onAgregar: vi.fn(), onAgregarBolsa: vi.fn() };
  const { rerender } = render(<InvoiceItemsGrid items={[item]} {...props} />);
  expect(screen.getByText(/cuenta 74.*Podría quedar pendiente de revisión/)).toBeTruthy();
  expect(screen.getByText(/cuenta no está activa.*importes no concuerdan/)).toBeTruthy();
  rerender(<InvoiceItemsGrid items={[{ ...item, descuento: { codigo: '00', monto: 1 } }]} {...props} />);
  expect(screen.queryByText(/cuenta 74/)).toBeNull();
  cleanup();
});
