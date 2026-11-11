import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoicesDashboardPage from '@/modules/invoices/pages/InvoicesDashboardPage';
import { normalizarMetricas } from '@/modules/invoices/lib/invoiceMetricsPeriodo';
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: {
  getMetrics: vi.fn(async () => ({ total: 8, emitidos: 6, aceptados: 4, pendientes: 2, rechazados: 1, facturado: 1100, tasaAceptacion: 80 })),
  getAlertas: vi.fn(async () => ({ gravedadGlobal: 'OK', dlq: { pendientes: 0 }, certificado: { gravedad: 'OK' } })),
} }));
afterEach(cleanup);
it('el panel distingue total registrado de aceptados y explica el criterio del neto', async () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={q}><MemoryRouter><InvoicesDashboardPage /></MemoryRouter></QueryClientProvider>);
  await screen.findByText('8');
  expect(screen.getByText('Comprobantes registrados (total)')).toBeTruthy();
  expect(screen.getByText(/neto solo de aceptados\/observados/)).toBeTruthy();
  expect(screen.queryByText('Comprobantes emitidos')).toBeNull(); q.clear();
});
it('transporta el total explícito y no inventa un total para un contrato antiguo', () => {
  expect(normalizarMetricas({ total: 8, emitidos: 6 }).total).toBe(8);
  expect(normalizarMetricas({ emitidos: 6 }).total).toBeUndefined();
});

it('6c-3 texto completo y contador rotulado sin cambiar su cifra', async () => {
 const q = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 render(<QueryClientProvider client={q}><MemoryRouter><InvoicesDashboardPage/></MemoryRouter></QueryClientProvider>);
 await screen.findByText('8');
 expect(screen.getByText(/menos NC más notas de débito \(ND\)/)).toBeTruthy();
 expect(screen.getByText('Sin confirmación SUNAT (incluye cola)').parentElement?.parentElement?.textContent).toContain('2');q.clear();
});
