import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceList } from '@/modules/invoices/InvoiceList';
import { InvoiceCdrModal } from '@/modules/invoices/components/InvoiceCdrModal';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { aInvoice } from '@/modules/invoices/lib/invoiceMapper';
import { aComprobanteDemo } from '@/modules/invoices/lib/invoiceApiMapper';
import { FILTROS_ESTADO } from '@/modules/invoices/components/InvoiceFiltersBar';
import { aplicarFiltros } from '@/modules/invoices/lib/invoiceFilters';
import { descargarDesdeBackend } from '@/modules/invoices/lib/invoiceDescarga';
import { extractApiErrorMessage } from '@/lib/apiErrors';
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { getInvoices: vi.fn(), getInvoiceById: vi.fn() } }));
vi.mock('@/modules/invoices/lib/invoiceDescarga', () => ({ obtenerXmlDesdeBackend: vi.fn(async () => null), extraerDigestValue: vi.fn(() => null), descargarDesdeBackend: vi.fn() }));
const item = (id: string, tipo: string, estado: string, cliente: string) => aInvoice({ id, tipo_comprobante: tipo, serie: tipo === '07' ? 'FC01' : 'F001', correlativo: Number(id), numero: `F001-0000000${id}`, fecha_emision: '2026-11-07', estado, monto_total: 118, moneda: 'PEN', cliente_documento: '20100070970', cliente_nombre: cliente, cdr_codigo: estado === 'ACEPTADO' ? '0' : null });
const filas = [item('1','01','ACEPTADO','Cliente uno'),item('2','01','ERROR_RED','Cliente dos'),item('3','07','ACEPTADO','Cliente dos')];
const queries: QueryClient[] = [];
beforeEach(() => { vi.mocked(invoicesApi.getInvoices).mockResolvedValue({ data: filas, total: 3, page: 1, pageSize: 100, totalPages: 1 }); });
afterEach(() => { cleanup(); sessionStorage.clear(); queries.splice(0).forEach((q) => q.clear()); vi.resetAllMocks(); });
it('F3 Error de red selecciona solo filas ERROR_RED tras el mapper real', () => {
  const opcion = FILTROS_ESTADO.find((f) => f.label === 'Incertidumbre de transporte')!;
  expect(opcion).toBeTruthy();
  expect(aplicarFiltros(filas.map(aComprobanteDemo), { busqueda: '', estado: opcion.value, desde: '', hasta: '' }).map((c) => c.id)).toEqual(['2']);
});
it('F4 la pestaña y la lista usan el mismo conjunto al buscar', async () => {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); queries.push(q);
  render(<QueryClientProvider client={q}><MemoryRouter initialEntries={['/invoices']}><InvoiceList /></MemoryRouter></QueryClientProvider>);
  await screen.findByText('Cliente uno');
  const tab = screen.getByRole('tab', { name: /Facturas y Boletas/ });
  expect(within(tab).getByText('2')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Buscar comprobantes'), { target: { value: 'Cliente dos' } });
  expect(within(tab).getByText('1')).toBeTruthy();
  expect(screen.queryByText('Cliente uno')).toBeNull();
  expect(screen.getByText('Cliente dos')).toBeTruthy();
});
it.each([false, true])('F5 CDR disponible=%s controla la descarga y extrae el motivo del servidor', async (tieneCdr) => {
  vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue({ ...filas[0], tieneCdr, historial: [] });
  vi.mocked(descargarDesdeBackend).mockRejectedValue({ message: 'Request failed with status code 404', response: { data: { detail: 'El CDR no está disponible en el almacén.' } } });
  render(<InvoiceCdrModal comprobante={aComprobanteDemo(filas[0])} onCerrar={vi.fn()} />);
  const boton = screen.getByRole('button', { name: 'Descargar CDR' }) as HTMLButtonElement;
  expect(boton.disabled).toBe(true);
  await screen.findByText('No hay eventos de auditoría registrados.');
  await waitFor(() => expect(boton.disabled).toBe(!tieneCdr));
  fireEvent.click(boton);
  if (tieneCdr) { expect(await screen.findByText(/El CDR no está disponible en el almacén/)).toBeTruthy(); expect(screen.queryByText('Request failed with status code 404')).toBeNull(); }
  else expect(descargarDesdeBackend).not.toHaveBeenCalled();
});
it('F5 usa un fallback legible cuando HTTP no trae motivo', () => {
  expect(extractApiErrorMessage(new Error('Request failed with status code 404'), 'No se pudo descargar.')).toBe('No se pudo descargar.');
});
