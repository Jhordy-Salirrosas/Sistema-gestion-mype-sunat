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
it('cambiar solo la fecha conserva el valor unitario y la liquidación', async () => {
  render(<MemoryRouter><InvoiceEmissionPage /></MemoryRouter>);
  await seleccionarProductoPrueba();
  const valor = screen.getByLabelText('Valor unitario de la línea 1') as HTMLInputElement;
  expect(valor.value).toBe('1000.00');
  expect(screen.getByText('S/ 1180.00')).toBeTruthy();
  const fecha = screen.getByLabelText('Fecha de emisión') as HTMLInputElement;
  const original = fecha.value;
  fireEvent.change(fecha, { target: { value: '2026-11-03' } });
  fireEvent.change(fecha, { target: { value: original } });
  expect(valor.value).toBe('1000.00');
  expect(screen.getByText('S/ 1180.00')).toBeTruthy();
});

function render(ui: ReactNode) { return rtlRender(ui, { wrapper: ({ children }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{children}</QueryClientProvider> }); }
