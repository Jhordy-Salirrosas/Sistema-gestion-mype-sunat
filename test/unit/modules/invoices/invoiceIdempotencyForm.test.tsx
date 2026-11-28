import { apiClient } from '@/lib/axios';
import { enqueueInvoiceEmission } from '@/lib/outbox';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,beforeEach as billingBeforeEach,expect,it,vi } from 'vitest';
import { confirmarRevisionSiAbierta,seleccionarProductoPrueba } from '../../../fixtures/invoiceEmissionProduct';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async (url: string) => ({ data: url === '/invoices/config' ? { series: [{ document_type: '01', series: 'F001', is_active: true }, { document_type: '03', series: 'B001', is_active: true }] } : [] })) } }));
vi.mock('@/lib/outbox', () => ({ enqueueInvoiceEmission: vi.fn(async () => 'queued') }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => [{sku:'SERV',descripcion:'Servicio',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true}]) }));
vi.mock('@/modules/invoices/components/RetencionMaestro', () => ({ RetencionMaestro: () => null }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { buscarClientes: vi.fn(async () => []), emitirComprobante: vi.fn() } }));
const clients: QueryClient[] = [];
beforeEach(() => { vi.clearAllMocks(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
afterEach(() => { cleanup(); clients.splice(0).forEach(q => q.clear()); });
async function montar(serieEsperada = 'F001') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  const onEmitir = vi.fn();
  render(<QueryClientProvider client={client}><MemoryRouter>{<InvoiceEmissionPage />}</MemoryRouter></QueryClientProvider>);
  await waitFor(() => expect((screen.getByLabelText('Serie configurada') as HTMLSelectElement).value).toBe(serieEsperada));
  fireEvent.change(screen.getByLabelText('RUC del cliente'), { target: { value: '20100070970' } });
  fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: 'Cliente de prueba' } });
  await seleccionarProductoPrueba();
  return { onEmitir, emitir: () => { fireEvent.click(screen.getByRole('button', { name: 'Emitir comprobante' })); confirmarRevisionSiAbierta(); } };
}
it.each(['pagina'])('%s: 409 conserva todos los datos y reintentar conserva la clave; editar inicia otro intento', async () => {
  vi.mocked(invoicesApi.emitirComprobante).mockRejectedValue({ response: { status: 409 } });
  const { onEmitir, emitir } = await montar();
  emitir();
  await screen.findByText(/Conflicto de emisión \(409\)/);
  const datos = () => [(screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value, screen.getByLabelText('Descripción de la línea 1').textContent, screen.getByLabelText('Valor unitario de la línea 1').textContent];
  expect(datos()).toEqual(['Cliente de prueba', 'Servicio', '100.00']);
  expect(onEmitir).not.toHaveBeenCalled();
  expect(enqueueInvoiceEmission).not.toHaveBeenCalled();
  const primera = vi.mocked(invoicesApi.emitirComprobante).mock.calls[0];
  emitir();
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(2));
  await screen.findByText(/Conflicto de emisión \(409\)/);
  expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[1]).toEqual(primera);
  expect(datos()).toEqual(['Cliente de prueba', 'Servicio', '100.00']);
  fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'), { target: { value: '2' } });
  emitir();
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(3));
  expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[2][1]).not.toBe(primera[1]);
});
it.each(['pagina'])('%s: al perder la red transfiere exactamente la clave del intento a la Outbox', async () => {
  vi.mocked(invoicesApi.emitirComprobante).mockRejectedValue(Object.assign(new Error('timeout'), { response: undefined }));
  const { emitir } = await montar();
  emitir();
  await waitFor(() => expect(enqueueInvoiceEmission).toHaveBeenCalledTimes(1));
  expect(vi.mocked(enqueueInvoiceEmission).mock.calls[0]).toEqual(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0]);
});
it.each(['pagina'])('%s: después de un alta exitosa incluso el mismo cuerpo obtiene otra clave', async () => {
  vi.mocked(invoicesApi.emitirComprobante).mockResolvedValue({ numero: 'F001-1', monto_total: 118, lineas: [], avisos: [] } as never);
  const { emitir } = await montar();
  emitir();
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(1));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Emitir comprobante' }) as HTMLButtonElement).disabled).toBe(false));
  {
    await seleccionarProductoPrueba();
  }
  emitir();
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(2));
  const [primera, segunda] = vi.mocked(invoicesApi.emitirComprobante).mock.calls;
  expect(segunda[0]).toEqual(primera[0]);
  expect(segunda[1]).not.toBe(primera[1]);
});
it('la página usa la serie activa de configuración aunque no sea F001', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: url === '/invoices/config' ? {
    series: [{ document_type: '01', series: 'F087', is_active: true }, { document_type: '01', series: 'F001', is_active: false }],
  } : [] }));
  vi.mocked(invoicesApi.emitirComprobante).mockResolvedValue({ numero: 'F087-1', monto_total: 118, lineas: [], avisos: [] } as never);
  const { emitir } = await montar('F087');
  emitir();
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({ serie: 'F087' }), expect.any(String)));
});
it.each(['pagina'])('%s: envía el almacén elegido y lo conserva al reintentar', async () => {
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/invoices/warehouses'
    ? [{ warehouse_code: 'ALM-01', description: 'Principal' }, { warehouse_code: 'ALM-02', description: 'Sucursal' }]
    : url === '/invoices/config' ? { series: [{ document_type: '01', series: 'F001', is_active: true }] } : [] }));
  vi.mocked(invoicesApi.emitirComprobante).mockRejectedValue({ response: { status: 409 } });
  const { emitir } = await montar();
  await screen.findByRole('option', { name: 'ALM-02 — Sucursal' });
  expect((screen.getByLabelText('Almacén de salida') as HTMLSelectElement).value).toBe('ALM-01');
  fireEvent.change(screen.getByLabelText('Almacén de salida'), { target: { value: 'ALM-02' } });
  emitir(); await screen.findByText(/Conflicto de emisión \(409\)/);
  expect(invoicesApi.emitirComprobante).toHaveBeenLastCalledWith(expect.objectContaining({ almacen: 'ALM-02' }), expect.any(String));
  emitir(); await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(2));
  expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0]).toEqual(vi.mocked(invoicesApi.emitirComprobante).mock.calls[1]);
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
