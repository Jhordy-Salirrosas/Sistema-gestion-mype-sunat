import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { buscarClientes: vi.fn(async () => []) } }));
afterEach(cleanup);
const montar = () => render(<MemoryRouter><InvoiceEmissionPage /></MemoryRouter>);
it('10 bolsas ingresadas en una línea calculan S/ 5 de ICBPER', () => {
  montar();
  fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('ICBPER de la línea 1'), { target: { value: '10' } });
  expect(screen.getByText('S/ 1185.00')).toBeTruthy();
});
it('el botón carga bolsas sobre el producto sin crear una línea sintética', () => {
  montar();
  fireEvent.change(screen.getByLabelText('Código de la línea 1'), { target: { value: 'CEM-001' } });
  fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: /Bolsa plástica/ }));
  expect(screen.queryByLabelText('Cantidad de la línea 2')).toBeNull();
  expect((screen.getByLabelText('ICBPER de la línea 1') as HTMLInputElement).value).toBe('1');
  fireEvent.change(screen.getByLabelText('ICBPER de la línea 1'), { target: { value: '10' } });
  expect(screen.getByText('S/ 1185.00')).toBeTruthy();
});

function render(ui: ReactNode) { return rtlRender(ui, { wrapper: ({ children }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{children}</QueryClientProvider> }); }
