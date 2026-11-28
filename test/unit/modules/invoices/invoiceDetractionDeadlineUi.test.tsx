import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InvoiceDetractionsPage from '@/modules/invoices/pages/InvoiceDetractionsPage';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/axios', () => ({ apiClient: mocks }));
const base = { id: 'i', numero: 'F001-00000001', date: '2026-11-13', customer: 'Cliente', total: 1000, detraction: 100, depositedTotal: 0, balance: 100, deposits: [] };
let qc: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-12-08T15:00:00Z'));
  mocks.get.mockResolvedValue({ data: [base] });
  mocks.post.mockResolvedValue({ data: {} }); mocks.put.mockResolvedValue({ data: {} });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); qc.clear(); vi.restoreAllMocks(); });
function mount() { render(<QueryClientProvider client={qc}><InvoiceDetractionsPage /></QueryClientProvider>); }

it('distingue pendientes vencidos, movimientos tardíos y registros históricos de depósitos oportunos', async () => {
  const deposit = (date: string) => ({ id: 'm', date, amount: 100, constancia: '001' });
  const rows = [
    base,
    { ...base, depositedTotal: 100, balance: 0, deposits: [deposit('2026-12-07')] },
    { ...base, depositedTotal: 100, balance: 0, deposits: [deposit('2026-12-08')] },
    { ...base, depositedTotal: 100, balance: 0, deposits: [{ ...deposit('2026-12-01'), amount: 40 }, { ...deposit('2026-12-08'), id: 'm2', amount: 60 }] },
    { ...base, depositedTotal: 50, balance: 50, deposits: [{ ...deposit('2026-12-07'), amount: 50 }] },
    { ...base, date: '2026-12-01' },
    { ...base, depositedTotal: 100, balance: 0, deposits: undefined, depositedAt: '2026-12-08' },
    { ...base, depositedTotal: 100, balance: 0, deposits: undefined, depositedAt: '2026-12-07' },
  ].map((row, i) => ({ ...row, id: String(i), numero: `F001-${i}` }));
  mocks.get.mockResolvedValue({ data: rows }); mount();
  await screen.findByText('F001-0');
  rows.forEach((row, i) => {
    const tr = screen.getByText(row.numero).closest('tr')!;
    expect(Boolean(within(tr).queryByText('Fuera de plazo'))).toBe([true, false, true, true, true, false, true, false][i]);
  });
});

it.each(['Registrar', 'Editar'] as const)('%s: la advertencia de fecha tardía no bloquea ni altera el guardado', async modo => {
  if (modo === 'Editar') mocks.get.mockResolvedValue({ data: [{ ...base, balance: 0, depositedTotal: 100, deposits: [{ id: 'm1', date: '2026-12-07', amount: 100, constancia: '001' }] }] });
  mount(); fireEvent.click(await screen.findByRole('button', { name: modo === 'Registrar' ? 'Registrar' : 'Editar depósitos de F001-00000001' }));
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-12-08' } });
  const warning = screen.getByRole('status', { name: 'Advertencia de plazo del depósito' });
  expect(warning).toHaveTextContent('07/12/2026');
  expect(warning).toHaveTextContent('50 %'); expect(warning).toHaveTextContent('crédito fiscal');
  expect(screen.getByRole('button', { name: 'Guardar depósito' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-12-07' } });
  expect(screen.queryByRole('status', { name: 'Advertencia de plazo del depósito' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-12-08' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar depósito' }));
  const body = { amount: 100, date: '2026-12-08', constancia: modo === 'Registrar' ? '' : '001' };
  await waitFor(() => modo === 'Registrar'
    ? expect(mocks.post).toHaveBeenCalledWith('/invoices/detractions/i', body)
    : expect(mocks.put).toHaveBeenCalledWith('/invoices/detractions/i/deposits/m1', body));
  expect(modo === 'Registrar' ? mocks.put : mocks.post).not.toHaveBeenCalled();
});

it('usa hoy en Lima y no adelanta el vencimiento a medianoche UTC', async () => {
  vi.mocked(Date.now).mockReturnValue(Date.parse('2026-12-08T02:00:00Z')); // Lima aún está en el día límite 7.
  mount(); await screen.findByText(base.numero);
  expect(screen.queryByText('Fuera de plazo')).toBeNull();
});
