import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { buscarClientes: vi.fn(async () => []), emitirComprobante: vi.fn() } }));
it('avisa RUC inválido o DNI en factura y acepta un RUC válido escrito manualmente', () => {
  render(<MemoryRouter><InvoiceEmissionPage /></MemoryRouter>);
  const doc = screen.getByLabelText('RUC del cliente');
  fireEvent.change(doc, { target: { value: '20100070971' } });
  expect(screen.getByText(/Factura exige un RUC válido/)).toBeTruthy();
  fireEvent.change(doc, { target: { value: '45896325' } });
  expect(screen.getByText(/Factura exige un RUC válido/)).toBeTruthy();
  fireEvent.change(doc, { target: { value: '20100070970' } });
  expect(screen.queryByText(/Factura exige un RUC válido/)).toBeNull();
  cleanup();
});

function render(ui: ReactNode) { return rtlRender(ui, { wrapper: ({ children }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{children}</QueryClientProvider> }); }
