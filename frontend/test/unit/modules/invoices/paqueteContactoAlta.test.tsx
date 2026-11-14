import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartnerFormDialog } from '@/modules/customs/components/PartnerFormDialog';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async () => ({ data: [] })), post: vi.fn(async (_url, payload) => ({ data: { id: 'tercero', ...payload } })), put: vi.fn(async () => ({ data: {} })) } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('el alta real transmite email y teléfono junto a los campos generales sin descartarlos', async () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={q}><PartnerFormDialog initialRole="CLIENTE" onClose={vi.fn()} /></QueryClientProvider>);
  for (const [label, value] of [['Número', '20100070970'], ['Razón social', 'Empresa de prueba'], ['Nombre comercial', 'Comercial'], ['Dirección fiscal / operativa', 'Av. Prueba 123'], ['Email de contacto', 'persona@example.invalid'], ['Teléfono', '+51 999111222']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar tercero' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/master-data/partners', expect.objectContaining({ docNumber: '20100070970', legalName: 'Empresa de prueba', tradeName: 'Comercial', address: 'Av. Prueba 123', email: 'persona@example.invalid', phone: '+51 999111222', countryCode: 'PE', roles: ['CLIENTE'], paymentTerms: 'CONTADO', hasCredit: false, allowsDiscount: false, currencyCode: 'PEN' })));
  q.clear();
});
