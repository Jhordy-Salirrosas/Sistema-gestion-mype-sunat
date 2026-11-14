import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import InvoiceSettingsPage from '@/modules/invoices/pages/InvoiceSettingsPage';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
const empresa = { tenantId: 'empresa', ruc: '20614142503', razonSocial: 'Empresa ficticia' };
let config: { ruc: string; origen_ruc: 'company' | 'issuer_config'; entorno: string; series: [] };
const clients: QueryClient[] = [];
beforeEach(() => {
  config = { ruc: empresa.ruc, origen_ruc: 'company', entorno: 'MOCK', series: [] };
  useAuthStore.setState({ token: 'token-ficticio', activeCompany: empresa, user: { id: 'admin', email: 'admin@example.invalid', role: 'ADMIN' } });
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/invoices/config' ? config : url === '/invoices/series' ? [] : {} }));
  vi.mocked(apiClient.put).mockImplementation(async (_url, body) => {
    const ruc = (body as { issuer_ruc: string | null }).issuer_ruc;
    config = { ...config, ruc: ruc ?? empresa.ruc, origen_ruc: ruc ? 'issuer_config' : 'company' };
    return { data: config };
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(q => q.clear()); useAuthStore.getState().logout(); vi.resetAllMocks(); });
async function mount() {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(q);
  render(<QueryClientProvider client={q}><MemoryRouter><InvoiceSettingsPage /></MemoryRouter></QueryClientProvider>);
  return await screen.findByLabelText('RUC emisor (M1)') as HTMLInputElement;
}
it('edita y persiste por el PUT real, refresca origen y mantiene el RUC de sesión', async () => {
  const input = await mount(); expect(input.readOnly).toBe(false); expect(input.value).toBe('');
  expect(screen.getByText('Origen del RUC efectivo: RUC de la empresa')).toBeTruthy();
  fireEvent.change(input, { target: { value: '20601234567' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  await screen.findByText('Configuración guardada.');
  expect(apiClient.put).toHaveBeenCalledWith('/invoices/config', { issuer_ruc: '20601234567' });
  expect(screen.getByText('RUC efectivo: 20601234567')).toBeTruthy();
  expect(screen.getByText('Origen del RUC efectivo: Configuración del emisor M1')).toBeTruthy();
  expect(useAuthStore.getState().activeCompany).toEqual(empresa);
});
it('vacío limpia la configuración M1 mediante null y muestra el respaldo de empresa', async () => {
  config = { ...config, ruc: '20601234567', origen_ruc: 'issuer_config' };
  const input = await mount(); expect(input.value).toBe('20601234567');
  fireEvent.change(input, { target: { value: '' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/invoices/config', { issuer_ruc: null }));
  expect(await screen.findByText('Origen del RUC efectivo: RUC de la empresa')).toBeTruthy();
  expect(screen.getByText(`RUC efectivo: ${empresa.ruc}`)).toBeTruthy();
});
it.each(['123', '123456789012', '1234567890X'])('rechaza formato inválido %s sin PUT', async valor => {
  const input = await mount(); fireEvent.change(input, { target: { value: valor } }); fireEvent.submit(input.closest('form')!);
  expect(await screen.findByText('El RUC emisor debe tener exactamente 11 dígitos o quedar vacío para limpiar.')).toBeTruthy(); expect(apiClient.put).not.toHaveBeenCalled();
});
it.each([[400, 'ISSUER_RUC_INVALID', /exactamente 11 dígitos/], [403, 'Forbidden', /Solo un administrador/]] as const)('presenta error %s del servidor y conserva la edición', async (status, message, texto) => {
  const input = await mount(); vi.mocked(apiClient.put).mockRejectedValue(new AxiosError('error', String(status), undefined, undefined, { status, statusText: 'error', data: { message }, headers: {}, config: { headers: new AxiosHeaders() } }));
  fireEvent.change(input, { target: { value: '20601234567' } }); fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
  expect(await screen.findByText(texto)).toBeTruthy(); expect(input.value).toBe('20601234567'); expect(screen.queryByText('Configuración guardada.')).toBeNull();
});
