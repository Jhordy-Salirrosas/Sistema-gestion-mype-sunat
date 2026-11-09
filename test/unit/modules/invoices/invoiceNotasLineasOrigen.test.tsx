import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { apiClient } from '@/lib/axios';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
const factura = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 100, estado: 'ACEPTADO' });
const fila = { id: factura.id, tipo_comprobante: '01', serie: 'F001', correlativo: 56, numero: 'F001-00000056', fecha_emision: '2026-11-05', estado: 'ACEPTADO', monto_total: 118, moneda: 'PEN', cliente_documento: '20100070970', cliente_nombre: 'Cliente', cdr_codigo: '0', ruc_emisor: '20601012341', base_imponible: 100, total_igv: 18, cdr: null };
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each(['07', '08'] as const)('precarga y permite editar las líneas reales en nota %s', async (tipo) => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: String(url).endsWith('/saldo') ? { total: 118, devuelto: 0, disponible: 118 } : { ...fila, lineas_origen: [{ codigo: 'MAT-1', descripcion: 'Cemento real', unidad: 'NIU', cantidad: 2, valor_unitario: 50, precio_unitario: 59, afectacion: '10' }] } }) as never);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial={tipo} fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
  await waitFor(() => expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Cemento real'));
  expect((screen.getByLabelText('Valor unitario de la línea 1') as HTMLInputElement).value).toBe('50');
  fireEvent.change(screen.getByLabelText('Descripción de la línea 1'), { target: { value: 'Cemento editado' } });
  expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Cemento editado');
  expect(await screen.findByText(/Disponible según servidor S\/ 118.00/)).toBeTruthy();
  query.clear();
});

it('deja vacía la línea si el detalle no contiene líneas', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: String(url).endsWith('/saldo') ? { total: 118, devuelto: 0, disponible: 118 } : fila }) as never);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="07" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(`/invoices/${factura.id}`));
  expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('');
  query.clear();
});

it('no inventa una afectación que la grilla no puede representar', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: String(url).endsWith('/saldo') ? { total: 118, devuelto: 0, disponible: 118 } : { ...fila, lineas_origen: [{ codigo: 'MAT-1', descripcion: 'Exportación', unidad: 'NIU', cantidad: 1, valor_unitario: 100, precio_unitario: 100, afectacion: '40' }] } }) as never);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial="07" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
  expect(await screen.findByText(/datos incompletos o no compatibles/)).toBeTruthy();
  expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('');
  query.clear();
});
