import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { problemaDeFechaEmision, minimoDeFechaEmision } from '@/modules/invoices/lib/invoiceEmitFecha';
import { hoyEnLima } from '@/modules/invoices/lib/invoiceFecha';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(async (url: string) => ({ data: url === '/invoices/config' ? { series: seriesConfiguradasPrueba } : [] })) } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
vi.mock('@/modules/invoices/components/RetencionMaestro', () => ({ RetencionMaestro: () => null }));
afterEach(cleanup);
it.each(['01', '03'] as const)('valida existencia y futuro igual para %s, manteniendo hoy en Lima', tipo => {
  expect(problemaDeFechaEmision('', '2026-11-13', tipo)).toContain('Indique');
  expect(problemaDeFechaEmision('2026-02-30', '2026-11-13', tipo)).toContain('no existe');
  expect(problemaDeFechaEmision('2026-11-14', '2026-11-13', tipo)).toContain('futura');
  expect(problemaDeFechaEmision('2026-11-13', '2026-11-13', tipo)).toBeNull();
});
it('factura acepta tres días exactos y rechaza cuatro con mensaje 2108, sin resumen diario', () => {
  expect(minimoDeFechaEmision('2026-11-13', '01')).toBe('2026-11-10');
  expect(problemaDeFechaEmision('2026-11-10', '2026-11-13', '01')).toBeNull();
  expect(problemaDeFechaEmision('2026-11-09', '2026-11-13', '01')).toContain('2108');
  expect(problemaDeFechaEmision('2026-11-09', '2026-11-13', '01')).not.toContain('resumen');
});
it('boleta conserva siete días y exactamente el texto heredado al excederlos', () => {
  expect(minimoDeFechaEmision('2026-11-13', '03')).toBe('2026-11-06');
  expect(problemaDeFechaEmision('2026-11-06', '2026-11-13', '03')).toBeNull();
  expect(problemaDeFechaEmision('2026-11-05', '2026-11-13', '03')).toBe('La fecha de emisión quedó 8 días atrás y el resumen diario solo admite 7 (regla 2957): el comprobante no se podría informar.');
});
it('el mínimo de fecha de la página real cambia al elegir factura o boleta', async () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={q}><MemoryRouter><InvoiceEmissionPage /></MemoryRouter></QueryClientProvider>);
  const date = screen.getByLabelText('Fecha de emisión') as HTMLInputElement;
  expect(date.min).toBe(minimoDeFechaEmision(hoyEnLima(), '01'));
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
  const tipo = selects.find(s => Array.from(s.options).some(o => o.value === '03'))!;
  fireEvent.change(tipo, { target: { value: '03' } });
  await waitFor(() => expect(date.min).toBe(minimoDeFechaEmision(hoyEnLima(), '03'))); q.clear();
});
