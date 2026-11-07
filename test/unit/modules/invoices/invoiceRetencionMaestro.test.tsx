import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RetencionMaestro } from '@/modules/invoices/components/RetencionMaestro';
import { apiClient } from '@/lib/axios';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('consulta el maestro y permite corrección explícita', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: String(url).endsWith('tax-status')
    ? [{ indicator: 'RETENCION', value: true }] : [{ id: 'p1', doc_type: '6', doc_number: '20601234567' }] }) as never);
  const onChange = vi.fn();
  const props = { documento: '20601234567', razonSocial: 'Empresa', valor: false, onChange };
  const view = render(<RetencionMaestro {...props} />);
  expect(await screen.findByText(/según maestro: Sí/)).toBeTruthy();
  expect(onChange).toHaveBeenCalledWith(true, false);
  view.rerender(<RetencionMaestro {...props} valor={true} />);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(onChange).toHaveBeenLastCalledWith(false, true);
  view.rerender(<RetencionMaestro {...props} valor={false} />);
  expect(screen.getByText(/difiere del maestro/)).toBeTruthy();
});

it('permite crear un cliente ausente sin impedir la selección manual', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: [] } as never);
  vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'p1', doc_type: '6', doc_number: '20601234567' } } as never);
  render(<RetencionMaestro documento="20601234567" razonSocial="Empresa" valor={false} onChange={vi.fn()} />);
  expect(await screen.findByText(/Sin registro en el maestro/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Crear cliente/ }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/master-data/partners', expect.objectContaining({ docNumber: '20601234567', legalName: 'Empresa' })));
});
