import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartnerDetailDrawer } from '@/modules/customs/components/PartnerDetailDrawer';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
let banks: object[]; const clients: QueryClient[] = [];
function mount() { const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(q); return render(<QueryClientProvider client={q}><PartnerDetailDrawer partnerId="tercero" onClose={vi.fn()} /></QueryClientProvider>); }
beforeEach(() => { banks = []; vi.mocked(apiClient.get).mockImplementation(async () => ({ data: { id: 'tercero', legal_name: 'Tercero de prueba', roles: ['CLIENTE'], is_active: true, addresses: [], contacts: [], bank_accounts: [...banks] } })); });
afterEach(() => { cleanup(); clients.splice(0).forEach(q => q.clear()); vi.resetAllMocks(); });
async function completar() {
  fireEvent.click(await screen.findByRole('button', { name: 'Bancos' }));
  fireEvent.change(screen.getByPlaceholderText('Banco'), { target: { value: 'BCP' } });
  fireEvent.change(screen.getByPlaceholderText('Número de cuenta'), { target: { value: '123456789' } });
}
it('guarda por el endpoint real, relee BCP/USD y conserva la cuenta al reabrir la ficha', async () => {
  vi.mocked(apiClient.post).mockImplementation(async (_url, payload) => { const p = payload as { bankName: string; accountNumber: string; currencyCode: string }; const bank = { id: 'banco', bank_name: p.bankName, account_number: p.accountNumber, currency_code: p.currencyCode }; banks.push(bank); return { data: bank }; });
  const view = mount(); await completar(); fireEvent.click(screen.getByRole('button', { name: 'Agregar cuenta' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/master-data/partners/tercero/bank-accounts', expect.objectContaining({ bankName: 'BCP', accountNumber: '123456789', currencyCode: 'USD' })));
  expect(await screen.findByText(/123456789/)).toBeTruthy();
  view.unmount(); mount(); fireEvent.click(await screen.findByRole('button', { name: 'Bancos' })); expect(await screen.findByText(/123456789/)).toBeTruthy();
});
it('un rechazo conserva los datos ingresados, muestra error y no añade una fila aparente', async () => {
  vi.mocked(apiClient.post).mockRejectedValue({ response: { status: 401, data: { message: 'Sesión expirada' } } });
  mount(); await completar(); fireEvent.click(screen.getByRole('button', { name: 'Agregar cuenta' }));
  expect(await screen.findByText('Sesión expirada')).toBeTruthy();
  expect((screen.getByPlaceholderText('Banco') as HTMLInputElement).value).toBe('BCP');
  expect(screen.getByText('Sin cuentas bancarias registradas.')).toBeTruthy();
  expect(screen.queryByText(/123456789/)).toBeNull();
});
