import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { apiClient } from '@/lib/axios';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
// La selección de M1 se resuelve desde el maestro, sin usar el lookup histórico.
const cliente = { tipoDocumento: '6', numeroDocumento: '20100070970', razonSocial: 'FERRETERÍA LOS ANDES S.A.C.' };
const sinTilde = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const montar = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><MemoryRouter><InvoiceEmissionPage /></MemoryRouter></QueryClientProvider>);
beforeEach(() => vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
  if (String(url).endsWith('/tax-status')) return { data: [] } as never;
  if (url !== '/master-data/partners') throw new Error(`Ruta inesperada: ${url}`);
  const params = config?.params as { q?: string } | undefined;
  const q = String(params?.q ?? '');
  const coincide = /^\d+$/.test(q) ? cliente.numeroDocumento.startsWith(q) : sinTilde(cliente.razonSocial).includes(sinTilde(q));
  return { data: coincide ? [{ id: 'master-1', doc_type: cliente.tipoDocumento, doc_number: cliente.numeroDocumento, legal_name: cliente.razonSocial, roles: ['CLIENTE'], is_active: true }] : [] } as never;
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('búsqueda real del formulario de emisión', () => {
  it('limpia la razón social al editar el documento de un cliente seleccionado', async () => {
    const usuario = userEvent.setup(); montar();
    await usuario.type(screen.getByLabelText('RUC del cliente'), '20100070970');
    await usuario.click(await screen.findByRole('button', { name: /FERRETERÍA LOS ANDES S.A.C./i }));
    expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe(cliente.razonSocial);
    await usuario.type(screen.getByLabelText('RUC del cliente'), '{backspace}');
    expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe('');
  });
  it.each(['FERRETERIA', 'FERRETERÍA'])('busca %s por razón social y llena el documento al elegir', async (nombre) => {
    const usuario = userEvent.setup(); montar();
    await usuario.type(screen.getByLabelText('Razón social / nombre'), nombre);
    expect(screen.getByRole('status').textContent).toContain('Buscando');
    const sugerencia = await screen.findByRole('button', { name: /FERRETERÍA LOS ANDES S.A.C./i });
    expect(apiClient.get).toHaveBeenCalledWith('/master-data/partners', { params: { role: 'CLIENTE', q: nombre } });
    await usuario.click(sugerencia);
    expect((screen.getByLabelText('RUC del cliente') as HTMLInputElement).value).toBe('20100070970');
    expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe(cliente.razonSocial);
  });
  it('envía el RUC al mismo endpoint y muestra el cliente', async () => {
    const usuario = userEvent.setup(); montar();
    await usuario.type(screen.getByLabelText('RUC del cliente'), '20100070970');
    expect(await screen.findByRole('button', { name: /FERRETERÍA LOS ANDES S.A.C./i })).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith('/master-data/partners', { params: { role: 'CLIENTE', q: '20100070970' } });
  });
  it('informa el error de red sin mostrar cero resultados como respuesta', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('red'));
    const usuario = userEvent.setup(); montar();
    await usuario.type(screen.getByLabelText('Razón social / nombre'), 'FERRETERIA');
    expect(screen.getByRole('status').textContent).toContain('Buscando');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo buscar'));
    expect(screen.queryByText(/Sin coincidencias/)).toBeNull();
  });
});

it('también busca por nombre desde el formulario de notas', async () => {
  const usuario = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><InvoiceEmitModal tipoInicial="07" fecha="2026-11-05" existentes={[]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  await usuario.type(screen.getByLabelText('Razón social / nombre'), 'FERRETERIA');
  expect(await screen.findByRole('button', { name: /FERRETERÍA LOS ANDES S.A.C./i })).toBeTruthy();
  expect(apiClient.get).toHaveBeenCalledWith('/master-data/partners', { params: { role: 'CLIENTE', q: 'FERRETERIA' } });
  cleanup(); client.clear();
});

it('también limpia la razón social en notas al editar el documento elegido', async () => {
  const usuario = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><InvoiceEmitModal tipoInicial="07" fecha="2026-11-05" existentes={[]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  await usuario.type(screen.getByLabelText('Razón social / nombre'), 'FERRETERIA');
  await usuario.click(await screen.findByRole('button', { name: /FERRETERÍA LOS ANDES S.A.C./i }));
  const doc = screen.getByLabelText('RUC / DNI del cliente');
  await usuario.type(doc, '{backspace}');
  expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe('');
  cleanup(); client.clear();
});
