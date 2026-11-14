import { seleccionarProductoPrueba } from '../../../fixtures/invoiceEmissionProduct';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => [{sku:'SERV',descripcion:'Servicio',unidad:'NIU',valorUnitario:1000,precioUnitario:1180,afectacion:'10',stock:100,vendible:true}]) }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { buscarClientes: vi.fn(async () => []) } }));
afterEach(cleanup);
const montar = () => render(<MemoryRouter><InvoiceEmissionPage /></MemoryRouter>);
it('10 bolsas ingresadas en una línea calculan S/ 5 de ICBPER', async () => {
  montar();
  await seleccionarProductoPrueba();
  fireEvent.change(screen.getByLabelText('ICBPER de la línea 1'), { target: { value: '10' } });
  expect(screen.getByText('S/ 1185.00')).toBeTruthy();
});
it('el botón carga bolsas sobre el producto sin crear una línea sintética', async () => {
  montar();
  await seleccionarProductoPrueba();
  expect(screen.queryByRole('button', { name: /Bolsa plástica/ })).toBeNull();
  fireEvent.change(screen.getByLabelText('ICBPER de la línea 1'), { target: { value: '1' } });
  expect(screen.queryByLabelText('Cantidad de la línea 2')).toBeNull();
  expect((screen.getByLabelText('ICBPER de la línea 1') as HTMLInputElement).value).toBe('1');
  fireEvent.change(screen.getByLabelText('ICBPER de la línea 1'), { target: { value: '10' } });
  expect(screen.getByText('S/ 1185.00')).toBeTruthy();
});

function render(ui: ReactNode) { return rtlRender(ui, { wrapper: ({ children }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{children}</QueryClientProvider> }); }
