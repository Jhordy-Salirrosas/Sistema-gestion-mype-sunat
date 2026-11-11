import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { admiteNota, comprobantesElegibles } from '@/modules/invoices/lib/invoiceNotaOrigen';
import type { ReactNode } from 'react';

vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { getSaldoNota: vi.fn(), getInvoiceById: vi.fn(), emitirComprobante: vi.fn() } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
vi.mock('@/modules/invoices/components/RetencionMaestro', () => ({ RetencionMaestro: () => null }));
// APIs de puntero ausentes en jsdom, usadas por el Select real de Radix.
Object.assign(HTMLElement.prototype, { hasPointerCapture: () => false, setPointerCapture: () => {}, releasePointerCapture: () => {}, scrollIntoView: () => {} });
const origen = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'SUPERMERCADOS PERUANOS', fecha: '2026-11-07', base: 100, estado: 'ACEPTADO' });
const red = { ...origen, id: 'red', correlativo: 57, estado: 'SIN_CONFIRMAR' as const, estadoBackend: 'ERROR_RED' };
const dlq = { ...origen, id: 'dlq', correlativo: 58, estado: 'EN_COLA' as const, estadoBackend: 'PENDIENTE' };
const clientes: QueryClient[] = [];
function montar(ui: ReactNode) { const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clientes.push(q); return render(<QueryClientProvider client={q}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>); }
function modal(tipo: '01' | '07' | '08' = '07') { return <InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial={tipo} fecha="2026-11-07" existentes={[origen, red, dlq]} onEmitir={vi.fn()} onCerrar={vi.fn()} />; }
beforeEach(() => { vi.mocked(invoicesApi.getSaldoNota).mockResolvedValue({ total: 118, devuelto: 0, disponible: 118, motivos_totales: ['01', '02', '06'], cantidades_pendientes: [] }); vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue({ lineasOrigen: [] } as never); });
afterEach(() => { cleanup(); clientes.splice(0).forEach((q) => q.clear()); vi.resetAllMocks(); });

describe('F1 notas sobre aceptados', () => {
  it('excluye cola, red, DLQ y rechazados; admite observados de la elegibilidad', () => {
    const rechazado = { ...origen, estado: 'RECHAZADO' as const };
    const observado = { ...origen, estado: 'OBSERVADO' as const };
    expect(comprobantesElegibles([origen, red, dlq, rechazado, observado])).toEqual([origen, observado]);
    expect(admiteNota({ ...origen, tipo: '07' })).toBe(false);
  });
  it('ofrece solo aceptados y reemplaza y bloquea el cliente previo al vincular', async () => {
    montar(modal());
    fireEvent.change(screen.getByLabelText('RUC / DNI del cliente'), { target: { value: '10456789123' } });
    fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: 'FERRETERÍA' } });
    expect(screen.getByLabelText('Documento afectado').querySelectorAll('option[value]:not([value=""])')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
    const doc = screen.getByLabelText('RUC / DNI del cliente') as HTMLInputElement;
    expect(doc.value).toBe(origen.clienteRuc); expect(doc.disabled).toBe(true);
    const nombre = screen.getByLabelText('Razón social / nombre') as HTMLInputElement;
    expect(nombre.value).toBe(origen.clienteRazonSocial); expect(nombre.disabled).toBe(true);
    await screen.findByText(/Disponible según servidor/);
    fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000057' } });
    expect(screen.getByText(/Seleccione una factura o boleta ACEPTADA u OBSERVADA/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Emitir Nota de Crédito' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('expone el motivo real del rechazo del saldo', async () => {
    vi.mocked(invoicesApi.getSaldoNota).mockRejectedValue({ response: { data: { detail: 'El origen está en DLQ y no admite notas.' } } });
    montar(modal());
    fireEvent.change(screen.getByLabelText('Documento afectado'), { target: { value: 'F001-00000056' } });
    expect(await screen.findByText(/El origen está en DLQ y no admite notas/)).toBeTruthy();
  });
});
it('F2 separa y restaura el borrador de cada tipo durante cambios de formulario', async () => {
  const user = userEvent.setup(); montar(modal('01'));
  fireEvent.change(screen.getByLabelText('RUC / DNI del cliente'), { target: { value: '20100070970' } });
  fireEvent.change(screen.getByLabelText('Descripción de la línea 1'), { target: { value: 'Línea exclusiva factura' } });
  const elegir = async (nombre: string) => { await user.click(screen.getByLabelText('Tipo de comprobante')); await user.click(await screen.findByRole('option', { name: nombre })); };
  await elegir('07 - Nota de Crédito');
  expect((screen.getByLabelText('RUC / DNI del cliente') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Descripción de la línea 1'), { target: { value: 'Línea exclusiva nota' } });
  await elegir('01 - Factura');
  expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Línea exclusiva factura');
  await elegir('07 - Nota de Crédito');
  expect((screen.getByLabelText('Descripción de la línea 1') as HTMLInputElement).value).toBe('Línea exclusiva nota');
});
it.each(['modal', 'pagina'])('F6 avisa al intentar borrar la única línea en %s', (tipo) => {
  montar(tipo === 'modal' ? modal('01') : <InvoiceEmissionPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar la línea 1' }));
  expect(screen.getByRole('alert').textContent).toContain('Debe quedar al menos una línea');
  expect(screen.getByLabelText('Descripción de la línea 1')).toBeTruthy();
});
it.each(['modal', 'pagina'])('F7 limpia un intento fallido al corregir el formulario en %s', async (tipo) => {
  vi.mocked(invoicesApi.emitirComprobante).mockRejectedValue({ response: { data: { message: 'RUC rechazado' } }, message: 'RUC rechazado' });
  montar(tipo === 'modal' ? modal('01') : <InvoiceEmissionPage />);
  fireEvent.change(screen.getByLabelText(tipo === 'modal' ? 'RUC / DNI del cliente' : 'RUC del cliente'), { target: { value: '20100070970' } });
  fireEvent.change(screen.getByLabelText('Descripción de la línea 1'), { target: { value: 'Servicio' } });
  fireEvent.change(screen.getByLabelText('Valor unitario de la línea 1'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: tipo === 'modal' ? 'Emitir Factura' : 'Emitir comprobante' }));
  await screen.findByText('No se emitió');
  fireEvent.change(screen.getByLabelText('Descripción de la línea 1'), { target: { value: 'Servicio corregido' } });
  await waitFor(() => expect(screen.queryByText('No se emitió')).toBeNull());
});
