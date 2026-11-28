import { construir } from '@/modules/invoices/data/invoiceDemoTypes';
import { admiteNota,comprobantesElegibles } from '@/modules/invoices/lib/invoiceNotaOrigen';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,beforeEach as billingBeforeEach,describe,expect,it,vi } from 'vitest';
import { confirmarRevisionSiAbierta,seleccionarProductoPrueba } from '../../../fixtures/invoiceEmissionProduct';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';

vi.mock('@/lib/axios',()=>({apiClient:{get:vi.fn(async (url:string)=>({data:url==='/invoices/config'?{series:seriesConfiguradasPrueba}:[]}))}}));
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
beforeEach(() => { vi.mocked(invoicesApi.getSaldoNota).mockResolvedValue({ total: 118, devuelto: 0, disponible: 118, motivos_totales: ['01', '02', '06'], cantidades_pendientes: [] }); vi.mocked(invoicesApi.getInvoiceById).mockResolvedValue({ lineasOrigen: [] } as never); });
afterEach(() => { cleanup(); clientes.splice(0).forEach((q) => q.clear()); vi.resetAllMocks(); });

describe('F1 notas sobre aceptados', () => {
  it('excluye cola, red, DLQ y rechazados; admite observados de la elegibilidad', () => {
    const rechazado = { ...origen, estado: 'RECHAZADO' as const };
    const observado = { ...origen, estado: 'OBSERVADO' as const };
    expect(comprobantesElegibles([origen, red, dlq, rechazado, observado])).toEqual([origen, observado]);
    expect(admiteNota({ ...origen, tipo: '07' })).toBe(false);
  });
});
it.each(['pagina'])('F6 permite retirar la última línea y volver al catálogo en %s', async () => {
  montar(<InvoiceEmissionPage />);
  await seleccionarProductoPrueba(); fireEvent.click(screen.getByRole('button', { name: 'Eliminar la línea 1' }));
  expect(screen.queryByLabelText('Descripción de la línea 1')).toBeNull();
});
it.each(['pagina'])('F7 limpia un intento fallido al corregir el formulario en %s', async () => {
  vi.mocked(invoicesApi.emitirComprobante).mockRejectedValue({ response: { data: { message: 'RUC rechazado' } }, message: 'RUC rechazado' });
  montar(<InvoiceEmissionPage />);
  fireEvent.change(screen.getByLabelText('RUC del cliente'), { target: { value: '20100070970' } });
  fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: 'Cliente' } });
  await seleccionarProductoPrueba();
  fireEvent.click(screen.getByRole('button', { name: 'Emitir comprobante' }));
  confirmarRevisionSiAbierta();
  await screen.findByText('No se emitió');
  fireEvent.change(screen.getByLabelText('Cantidad de la línea 1'), { target: { value: '2' } });
  await waitFor(() => expect(screen.queryByText('No se emitió')).toBeNull());
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });
