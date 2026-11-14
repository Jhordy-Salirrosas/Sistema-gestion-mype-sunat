import { seleccionarProductoPrueba } from '../../../fixtures/invoiceEmissionProduct';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import PartnersPage from '@/modules/customs/pages/PartnersPage';
import { PartnerFormDialog } from '@/modules/customs/components/PartnerFormDialog';
import { apiClient } from '@/lib/axios';
import { masterDataApi, type BusinessPartnerRecord } from '@/modules/customs/services/masterDataApi';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { useAuthStore } from '@/stores/authStore';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
vi.mock('@/modules/customs/services/masterDataApi', () => ({ masterDataApi: { getPartners: vi.fn(), getPartner: vi.fn(), createPartner: vi.fn() } }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { emitirComprobante: vi.fn() } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => [{sku:'SERV',descripcion:'Servicio',unidad:'NIU',valorUnitario:100,precioUnitario:118,afectacion:'10',stock:100,vendible:true}]) }));
vi.mock('@/modules/invoices/components/RetencionMaestro', () => ({ RetencionMaestro: () => null }));
const ruc = '20100070970';
const datos = { ruc, razonSocial: 'RECEPTOR CONSULTADO SAC', direccionFiscal: 'Av. Receptor 123', ubigeo: '150101', estadoContribuyente: 'ACTIVO', condicionDomicilio: 'HABIDO' };
const partner: BusinessPartnerRecord = { id: 'cliente', company_id: 'empresa', doc_type: '6', doc_number: ruc, legal_name: 'CLIENTE DEL MAESTRO', address: 'Dirección del maestro', roles: ['CLIENTE'], is_active: true, country_code: 'PE' };
const clients: QueryClient[] = [];
function mount(node: React.ReactNode) {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(q);
  return render(<QueryClientProvider client={q}><MemoryRouter initialEntries={['/invoices/emision']}>{node}</MemoryRouter></QueryClientProvider>);
}
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const escribir = (label: string, valor: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });
const consultar = () => vi.mocked(apiClient.get).mock.calls.filter(([url]) => String(url).startsWith('/sunat/ruc/'));
beforeEach(() => {
  useAuthStore.setState({ token: 'token-ficticio', user: { id: 'admin', email: 'admin@example.invalid', role: 'ADMIN' } });
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/invoices/config' ? { series: seriesConfiguradasPrueba } : String(url).startsWith('/sunat/ruc/') ? datos : [] }));
  vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([]);
  vi.mocked(masterDataApi.createPartner).mockResolvedValue(partner);
  vi.mocked(invoicesApi.emitirComprobante).mockResolvedValue({ numero: 'F001-1', monto_total: 118, lineas: [], avisos: [] } as never);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(q => q.clear()); useAuthStore.getState().logout(); vi.resetAllMocks(); });
async function emitir() {
  await seleccionarProductoPrueba();
  fireEvent.click(screen.getByRole('button', { name: 'Emitir comprobante' }));
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(1));
}
it('página real: rellena receptor, permite editar y transporta la dirección editada sin modificar emisor', async () => {
  const empresa = { tenantId: 'empresa', ruc: '20601012341', razonSocial: 'EMISOR ORIGINAL' };
  useAuthStore.setState({ activeCompany: empresa as never });
  mount(<InvoiceEmissionPage />); escribir('RUC del cliente', ruc);
  await waitFor(() => expect(value('Razón social / nombre')).toBe(datos.razonSocial));
  expect(value('Dirección del cliente')).toBe(datos.direccionFiscal);
  escribir('Razón social / nombre', 'RECEPTOR EDITADO'); escribir('Dirección del cliente', 'Dirección editada');
  expect(value('RUC del cliente')).toBe(ruc); await emitir();
  expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({ customer_identity_number: ruc, customer_legal_name: 'RECEPTOR EDITADO', customer_address: 'Dirección editada' }), expect.any(String));
  expect(useAuthStore.getState().activeCompany).toEqual(empresa); expect(consultar()).toHaveLength(1);
});
it('la consulta fallida es informativa y permite emitir con datos manuales', async () => {
  vi.mocked(apiClient.get).mockImplementation(async url => {
    if (String(url).startsWith('/sunat/ruc/')) throw { response: { status: 404 } };
    return { data: url === '/invoices/config' ? { series: seriesConfiguradasPrueba } : [] };
  });
  mount(<InvoiceEmissionPage />); escribir('RUC del cliente', ruc);
  await screen.findByText(/No se pudo consultar el RUC/);
  escribir('Razón social / nombre', 'MANUAL'); escribir('Dirección del cliente', 'Dirección manual'); await emitir();
  expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({ customer_legal_name: 'MANUAL', customer_address: 'Dirección manual' }), expect.any(String));
});
it('no inventa dirección cuando el proveedor la omite', async () => {
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/invoices/config' ? { series: seriesConfiguradasPrueba } : { ...datos, direccionFiscal: null } }));
  mount(<InvoiceEmissionPage />); escribir('RUC del cliente', ruc);
  await screen.findByText(/no informó dirección/); expect(value('Dirección del cliente')).toBe('');
  await emitir(); expect(vi.mocked(invoicesApi.emitirComprobante).mock.calls[0][0]).not.toHaveProperty('customer_address');
});
it('la selección del maestro cancela la consulta y conserva su dirección y sus permisos', async () => {
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([partner]);
  mount(<InvoiceEmissionPage />); escribir('RUC del cliente', ruc);
  fireEvent.click(await screen.findByRole('button', { name: /CLIENTE DEL MAESTRO/ }));
  expect(value('Dirección del cliente')).toBe(partner.address);
  escribir('Razón social / nombre', 'OTRO RECEPTOR');
  expect(value('RUC del cliente')).toBe(''); expect(value('Dirección del cliente')).toBe('');
});
it('seleccionar un maestro sin dirección conserva el modo manual y editar documento limpia la dirección', async () => {
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([{ ...partner, address: undefined }]);
  mount(<InvoiceEmissionPage />); escribir('RUC del cliente', ruc);
  fireEvent.click(await screen.findByRole('button', { name: /CLIENTE DEL MAESTRO/ }));
  expect(value('Dirección del cliente')).toBe(''); escribir('Dirección del cliente', 'Manual');
  escribir('RUC del cliente', ruc.slice(0, 10)); expect(value('Dirección del cliente')).toBe('');
});
it('Facturación: alta real de cliente consulta RUC y guarda las correcciones editables', async () => {
  mount(<PartnersPage context="billing" />); fireEvent.click(screen.getByRole('button', { name: 'Nuevo tercero' }));
  escribir('Número', ruc); await waitFor(() => expect(value('Razón social')).toBe(datos.razonSocial));
  expect(value('Dirección fiscal / operativa')).toBe(datos.direccionFiscal);
  escribir('Razón social', 'CLIENTE EDITADO'); escribir('Dirección fiscal / operativa', 'Domicilio editado');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar tercero' }));
  await waitFor(() => expect(masterDataApi.createPartner).toHaveBeenCalledWith(expect.objectContaining({ docNumber: ruc, legalName: 'CLIENTE EDITADO', address: 'Domicilio editado', roles: ['CLIENTE'] })));
});
it('registro desde emisión usa el mismo autorrelleno', async () => {
  mount(<InvoiceEmissionPage />); fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente nuevo' }));
  escribir('Número', ruc); await waitFor(() => expect(value('Razón social')).toBe(datos.razonSocial));
  expect(value('Dirección fiscal / operativa')).toBe(datos.direccionFiscal);
});
it('registro con dirección ausente ofrece edición manual y error no bloqueante', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { ...datos, direccionFiscal: null } });
  mount(<PartnerFormDialog enableRucLookup initialRole="CLIENTE" onClose={vi.fn()} />);
  escribir('Número', ruc); await screen.findByText(/no informó dirección/); expect(value('Dirección fiscal / operativa')).toBe('');
  escribir('Dirección fiscal / operativa', 'Manual'); expect(value('Dirección fiscal / operativa')).toBe('Manual');
});
it.each(['tipo', 'país', 'rol', 'nombre', 'dirección'])('registro: una edición de %s cancela respuestas pendientes', async campo => {
  let resolver!: (value: { data: typeof datos }) => void;
  vi.mocked(apiClient.get).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  mount(<PartnerFormDialog enableRucLookup initialRole="CLIENTE" onClose={vi.fn()} />);
  escribir('Número', ruc); await waitFor(() => expect(consultar()).toHaveLength(1));
  if (campo === 'tipo') escribir('Tipo de documento', '1');
  if (campo === 'país') escribir('País (ISO ej. PE, CN, US)', 'US');
  if (campo === 'rol') fireEvent.click(screen.getByLabelText('CLIENTE'));
  if (campo === 'nombre') escribir('Razón social', 'Manual');
  if (campo === 'dirección') escribir('Dirección fiscal / operativa', 'Manual');
  await act(async () => resolver({ data: datos }));
  expect(value('Razón social')).not.toBe(datos.razonSocial); expect(value('Dirección fiscal / operativa')).not.toBe(datos.direccionFiscal);
});
it.each(['sin-opción', 'proveedor', 'extranjero', 'dni', 'inválido'])('no consulta fuera de un alta RUC de cliente: %s', async caso => {
  mount(<PartnerFormDialog enableRucLookup={caso !== 'sin-opción'} initialRole={caso === 'proveedor' ? 'PROVEEDOR' : 'CLIENTE'} onClose={vi.fn()} />);
  if (caso === 'extranjero') escribir('País (ISO ej. PE, CN, US)', 'US');
  if (caso === 'dni') escribir('Tipo de documento', '1');
  escribir('Número', caso === 'inválido' ? '20100070971' : caso === 'dni' ? '70123456' : ruc);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  expect(consultar()).toHaveLength(0);
});
it('el contexto compartido ajeno a Facturación conserva el alta sin consulta RUC', async () => {
  mount(<PartnersPage />); fireEvent.click(screen.getByRole('button', { name: 'Nuevo tercero' }));
  fireEvent.click(screen.getByLabelText('CLIENTE')); escribir('Número', ruc);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  expect(consultar()).toHaveLength(0); expect(value('Razón social')).toBe('');
});
