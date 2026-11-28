import { borradorInicial } from '@/modules/invoices/lib/invoiceEmitDraft';
import { borradorAPayloadEmision } from '@/modules/invoices/lib/invoiceEmitPayload';
import { hoyEnLima } from '@/modules/invoices/lib/invoiceFecha';
import { CATALOGO_59_MEDIOS_PAGO } from '@/modules/invoices/lib/medioPagoDetraccion';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach as billingBeforeEach,expect,it,vi } from 'vitest';
import { confirmarRevisionSiAbierta,seleccionarProductoPrueba } from '../../../fixtures/invoiceEmissionProduct';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async (url: string) => ({ data: url === '/invoices/config' ? { series: [{ document_type: '01', series: 'F001', is_active: true }, { document_type: '03', series: 'B001', is_active: true }] } : [] })) } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => [{sku:'SERV',descripcion:'Servicio',unidad:'NIU',valorUnitario:1000,precioUnitario:1180,afectacion:'10',stock:100,vendible:true}]) }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: {
  buscarClientes: vi.fn(async () => []), emitirComprobante: vi.fn(async () => { throw new Error('Respuesta de prueba'); }),
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('conserva los 22 códigos exactos y omite el campo sin detracción efectiva, incluso si quedó elegido', async () => {
  expect(Object.keys(CATALOGO_59_MEDIOS_PAGO)).toHaveLength(22);
  const b = { ...borradorInicial('01', hoyEnLima()), medioPagoDetraccion: '003' as const };
  expect(borradorAPayloadEmision(b)).not.toHaveProperty('medio_pago_detraccion');
});
it.each(['pagina'])('%s: solo aparece con detracción, bloquea vacío y envía el código elegido', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{<InvoiceEmissionPage />}</MemoryRouter></QueryClientProvider>);
  await waitFor(() => expect((screen.getByLabelText('Serie configurada') as HTMLSelectElement).value).toBe('F001'));
  expect(screen.queryByLabelText('Medio de pago de la detracción')).toBeNull();
  fireEvent.change(screen.getByLabelText('RUC del cliente'), { target: { value: '20100070970' } });
  fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: 'Cliente de prueba' } });
  await seleccionarProductoPrueba();
  fireEvent.change(screen.getByLabelText('Detracción de la línea 1'), { target: { value: '009' } });
  const selector = screen.getByLabelText('Medio de pago de la detracción') as HTMLSelectElement;
  expect(selector.value).toBe('');
  expect(selector.options).toHaveLength(3);
  const emitir = screen.getByRole('button', { name: /Emitir.*factura|Emitir comprobante|Emitir Factura|Emitir a SUNAT/i });
  fireEvent.click(emitir); confirmarRevisionSiAbierta();
  expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
  fireEvent.change(selector, { target: { value: '003' } });
  fireEvent.click(emitir); confirmarRevisionSiAbierta();
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({ medio_pago_detraccion: '003' }), expect.stringMatching(/^[A-Za-z0-9_-]{16,128}$/)));
  fireEvent.change(screen.getByLabelText('Detracción de la línea 1'), { target: { value: '' } });
  expect(screen.queryByLabelText('Medio de pago de la detracción')).toBeNull();
  client.clear();
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
