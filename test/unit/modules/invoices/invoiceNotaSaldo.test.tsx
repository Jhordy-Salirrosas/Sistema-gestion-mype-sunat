import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { buscarClientes: vi.fn(async () => []), getSaldoNota: vi.fn(async () => ({ total: 1770, devuelto: 100.01, disponible: 1669.99 })), emitirComprobante: vi.fn() } }));
describe('saldo de nota de crédito', () => {
  it('consulta y muestra el saldo y bloquea exceso sin emitir', async () => {
    const factura = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 1500, estado: 'ACEPTADO' });
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={query}><InvoiceEmitModal tipoInicial="07" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
    expect(await screen.findByText(/Disponible según servidor S\/ 1669.99/)).toBeTruthy();
    expect(screen.getByText(/base S\/ 1500.00/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Descripción de la línea 1'), { target: { value: 'Servicio' } });
    fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '2000' } });
    expect(screen.getByText(/La nota supera el saldo disponible/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Emitir Nota de Crédito' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup(); query.clear();
  });
});

it('muestra saldo en nota de débito y parte de línea vacía', async () => {
  const factura = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 1500, estado: 'ACEPTADO' });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal tipoInicial="08" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  expect((screen.getByLabelText('Código de la línea 1') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
  expect(await screen.findByText(/Disponible según servidor S\/ 1669.99/)).toBeTruthy();
  cleanup(); query.clear();
});
it('avisa el acreditado superior al total sin esconder el saldo', async () => {
  vi.mocked(invoicesApi.getSaldoNota).mockResolvedValueOnce({ total: 1003, devuelto: 1053.01, disponible: 0 });
  const factura = construir({ tipo: '01', serie: 'F001', correlativo: 53, ruc: '20100070970', razonSocial: 'Cliente', fecha: '2026-11-05', base: 850, estado: 'ACEPTADO' });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><InvoiceEmitModal tipoInicial="07" fecha="2026-11-05" existentes={[factura]} onEmitir={vi.fn()} onCerrar={vi.fn()} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000053' } });
  expect(await screen.findByText(/supera el total del comprobante/)).toBeTruthy();
  expect(screen.getByText(/Disponible según servidor S\/ 0.00/)).toBeTruthy();
  cleanup(); query.clear();
});
