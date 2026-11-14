import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { etiquetaCondicionPago } from '@/modules/customs/lib/paymentTerms';
import PartnersPage from '@/modules/customs/pages/PartnersPage';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async (url: string) => {
  const p = { id: 'tercero', doc_type: '6', doc_number: '20100070970', legal_name: 'Cliente crédito', country_code: 'PE', roles: ['CLIENTE'], is_active: true, has_credit: true, payment_terms: '30_DIAS' };
  return { data: url.endsWith('/tercero') ? { ...p, addresses: [], contacts: [], bank_accounts: [] } : [p, { ...p, id: 'contado', legal_name: 'Cliente contado', has_credit: false, payment_terms: 'CONTADO' }] };
}) } }));
afterEach(cleanup);
it.each([['CONTADO', 'Contado'], ['15_DIAS', '15 días'], ['30_DIAS', '30 días'], ['45_DIAS', '45 días'], ['60_DIAS', '60 días'], ['CARTA_CREDITO', 'Carta de crédito'], ['Al despacho', 'Al despacho'], ['toString', 'toString'], ['', '—'], [null, '—'], [undefined, '—']])('formatea %s sin cambiar el contrato: %s', (valor, etiqueta) => { expect(etiquetaCondicionPago(valor)).toBe(etiqueta); });
it('permite un texto vacío específico de la vista', () => { expect(etiquetaCondicionPago(null, 'No definida')).toBe('No definida'); });
it('tabla y ficha real reutilizan etiquetas humanas', async () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={q}><PartnersPage context="billing" /></QueryClientProvider>);
  expect(await screen.findByText('Crédito (30 días)')).toBeTruthy(); expect(screen.getByText('Contado')).toBeTruthy();
  expect(screen.queryByText('Crédito (30_DIAS)')).toBeNull(); fireEvent.click(screen.getByText('Cliente crédito'));
  expect(await screen.findByText('30 días')).toBeTruthy(); q.clear();
});
