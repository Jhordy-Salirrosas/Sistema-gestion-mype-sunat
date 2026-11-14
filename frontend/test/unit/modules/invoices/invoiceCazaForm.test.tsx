import { seleccionarProductoPrueba } from '../../../fixtures/invoiceEmissionProduct';
import { hoyEnLima } from '@/modules/invoices/lib/invoiceFecha';
import { beforeEach as billingBeforeEach } from 'vitest';
import { useAuthStore as billingAuth } from '@/stores/authStore';
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
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => [{sku:'SERV',descripcion:'Servicio',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true}]) }));
vi.mock('@/modules/invoices/components/RetencionMaestro', () => ({ RetencionMaestro: () => null }));
// APIs de puntero ausentes en jsdom, usadas por el Select real de Radix.
Object.assign(HTMLElement.prototype, { hasPointerCapture: () => false, setPointerCapture: () => {}, releasePointerCapture: () => {}, scrollIntoView: () => {} });
const origen = construir({ tipo: '01', serie: 'F001', correlativo: 56, ruc: '20100070970', razonSocial: 'SUPERMERCADOS PERUANOS', fecha: '2026-11-07', base: 100, estado: 'ACEPTADO' });
const red = { ...origen, id: 'red', correlativo: 57, estado: 'SIN_CONFIRMAR' as const, estadoBackend: 'ERROR_RED' };
const dlq = { ...origen, id: 'dlq', correlativo: 58, estado: 'EN_COLA' as const, estadoBackend: 'PENDIENTE' };
const clientes: QueryClient[] = [];
function montar(ui: ReactNode) { const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clientes.push(q); return render(<QueryClientProvider client={q}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>); }
function modal(tipo: '01' | '07' | '08' = '07') { return <InvoiceEmitModal seriesConfiguradas={seriesConfiguradasPrueba} tipoInicial={tipo} fecha={tipo === '01' ? hoyEnLima() : '2026-11-07'} existentes={[origen, red, dlq]} onEmitir={vi.fn()} onCerrar={vi.fn()} />; }
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
    fireEvent.click(screen.getByRole('button', { name: 'Emitir Nota de Crédito' }));
    expect(invoicesApi.emitirComprobante).not.toHaveBeenCalled();
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
  await seleccionarProductoPrueba(); fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'), { target: { value: '2' } });
  const elegir = async (nombre: string) => { await user.click(screen.getByLabelText('Tipo de comprobante')); await user.click(await screen.findByRole('option', { name: nombre })); };
  await elegir('07 - Nota de Crédito');
  expect((screen.getByLabelText('RUC / DNI del cliente') as HTMLInputElement).value).toBe('');
  expect(screen.queryByLabelText('Descripción de la línea 1')).toBeNull();
  await seleccionarProductoPrueba(); fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'), { target: { value: '3' } });
  await elegir('01 - Factura');
  expect((screen.getByLabelText('Cantidad de la línea 1') as HTMLInputElement).value).toBe('2');
  await elegir('07 - Nota de Crédito');
  expect((screen.getByLabelText('Cantidad de la línea 1') as HTMLInputElement).value).toBe('3');
});
it.each(['modal', 'pagina'])('F6 permite retirar la última línea y volver al catálogo en %s', async (tipo) => {
  montar(tipo === 'modal' ? modal('01') : <InvoiceEmissionPage />);
  await seleccionarProductoPrueba(); fireEvent.click(screen.getByRole('button', { name: 'Eliminar la línea 1' }));
  expect(screen.queryByLabelText('Descripción de la línea 1')).toBeNull();
});
it.each(['modal', 'pagina'])('F7 limpia un intento fallido al corregir el formulario en %s', async (tipo) => {
  vi.mocked(invoicesApi.emitirComprobante).mockRejectedValue({ response: { data: { message: 'RUC rechazado' } }, message: 'RUC rechazado' });
  montar(tipo === 'modal' ? modal('01') : <InvoiceEmissionPage />);
  fireEvent.change(screen.getByLabelText(tipo === 'modal' ? 'RUC / DNI del cliente' : 'RUC del cliente'), { target: { value: '20100070970' } });
  fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: 'Cliente' } });
  await seleccionarProductoPrueba();
  fireEvent.click(screen.getByRole('button', { name: tipo === 'modal' ? 'Emitir Factura' : 'Emitir comprobante' }));
  await screen.findByText('No se emitió');
  fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'), { target: { value: '2' } });
  await waitFor(() => expect(screen.queryByText('No se emitió')).toBeNull());
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
