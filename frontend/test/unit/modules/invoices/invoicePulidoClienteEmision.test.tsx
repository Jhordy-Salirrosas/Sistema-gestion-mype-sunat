import { beforeEach as billingBeforeEach } from 'vitest';
import { useAuthStore as billingAuth } from '@/stores/authStore';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InvoiceEmissionPage from '@/modules/invoices/pages/InvoiceEmissionPage';
import { InvoiceEmitModal } from '@/modules/invoices/components/InvoiceEmitModal';
import { hoyEnLima } from '@/modules/invoices/lib/invoiceFecha';
import { invoicesApi } from '@/modules/invoices/services/invoicesApi';
import { apiClient } from '@/lib/axios';
import { seriesConfiguradasPrueba } from '../../../fixtures/invoiceSeries';
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/modules/invoices/services/inventoryProductsApi', () => ({ cargarProductosAlmacen: vi.fn(async () => []) }));
vi.mock('@/modules/invoices/services/invoicesApi', () => ({ invoicesApi: { emitirComprobante: vi.fn() } }));
vi.mock('@/modules/invoices/components/RetencionMaestro', () => ({ RetencionMaestro: () => null }));
const cliente = { id: 'c', doc_type: '6', doc_number: '20100070970', legal_name: 'Ferretería Los Andes S.A.C.', roles: ['CLIENTE'], is_active: true, has_credit: false };
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/invoices/config' ? { series: seriesConfiguradasPrueba } : url === '/master-data/partners' ? [cliente] : [] }));
  vi.mocked(invoicesApi.emitirComprobante).mockResolvedValue({ numero: 'F001-66', monto_total: 118, lineas: [], avisos: [] } as never);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.resetAllMocks(); });
// El caso "texto-sin-confirmar" espera el debounce de búsqueda (300 ms) además
// del tipeo. Bajo carga, el timeout global de 5 s se queda corto y el test falla
// sin que exista un error funcional. Se le da un margen propio.
it.each(['pagina', 'modal'].flatMap(via => ['clic', 'teclado', 'texto-sin-confirmar'].map(modo => [via, modo])))('%s: %s vincula documento/nombre al payload del PRIMER intento sin reescribirlos', { timeout: 15000 }, async (via, modo) => {
  const usuario = userEvent.setup(); const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(q);
  render(<QueryClientProvider client={q}><MemoryRouter>{via === 'pagina' ? <InvoiceEmissionPage /> : <InvoiceEmitModal tipoInicial="01" seriesConfiguradas={seriesConfiguradasPrueba} fecha={hoyEnLima()} existentes={[]} onEmitir={vi.fn()} onCerrar={vi.fn()} />}</MemoryRouter></QueryClientProvider>);
  if (via === 'pagina') await waitFor(() => expect((screen.getByLabelText('Serie configurada') as HTMLSelectElement).value).toBe('F001'));
  // Preparar una línea antes de elegir al cliente evita editar los datos del cliente después de seleccionarlo.
  await usuario.type(screen.getByLabelText('Descripción de la línea 1'), 'Artículo de prueba');
  await usuario.clear(screen.getByLabelText('Valor unitario de la línea 1')); await usuario.type(screen.getByLabelText('Valor unitario de la línea 1'), '118');
  await usuario.type(screen.getByLabelText(via === 'pagina' ? 'RUC del cliente' : 'RUC / DNI del cliente'), cliente.doc_number);
  const sugerencia = await screen.findByRole('button', { name: /Ferretería Los Andes/ }, { timeout: 3000 });
  if (modo === 'clic') await usuario.click(sugerencia);
  else if (modo === 'teclado') { await usuario.tab(); expect(document.activeElement).toBe(sugerencia); await usuario.keyboard('{Enter}'); }
  else { await usuario.type(screen.getByLabelText('Razón social / nombre'), cliente.legal_name); }
  expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe(cliente.legal_name);
  const boton = screen.getByRole('button', { name: via === 'pagina' ? 'Emitir comprobante' : 'Emitir Factura' });
  // Texto sin confirmar conserva lo tipeado; no se incorpora selección implícita ni atajos nuevos.
  await usuario.click(boton);
  await waitFor(() => expect(invoicesApi.emitirComprobante).toHaveBeenCalledTimes(1), { timeout: 3000 });
  expect(invoicesApi.emitirComprobante).toHaveBeenCalledWith(expect.objectContaining({ customer_identity_number: cliente.doc_number, customer_identity_type: '6', customer_legal_name: cliente.legal_name }), expect.any(String));
  expect(screen.queryByText('Falta la razón social del cliente.')).toBeNull();
});

// Las operaciones de esta suite se ejecutan con un rol autorizado de facturación.
billingBeforeEach(() => { billingAuth.setState({ user: { id: 'billing-test', email: 'billing@example.invalid', role: 'ADMIN' } }); });

it('Parte 9 cambiar una factura al crédito a boleta borra el cronograma y bloquea crédito', async()=>{
 vi.mocked(apiClient.get).mockImplementation(async url=>({data:url==='/invoices/config'?{series:seriesConfiguradasPrueba}:url==='/master-data/partners'?[{...cliente,has_credit:true}]:[]}));
 const q=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});clients.push(q);
 render(<QueryClientProvider client={q}><MemoryRouter><InvoiceEmissionPage/></MemoryRouter></QueryClientProvider>);
 fireEvent.change(screen.getByLabelText('RUC del cliente'),{target:{value:cliente.doc_number}});
 fireEvent.click(await screen.findByRole('button',{name:/Ferretería Los Andes/}));
 const credito=screen.getByRole('button',{name:'Crédito'}) as HTMLButtonElement;expect(credito.disabled).toBe(false);fireEvent.click(credito);
 const tipo=screen.getByLabelText('Tipo de comprobante');fireEvent.change(tipo,{target:{value:'03'}});
 expect((screen.getByRole('button',{name:'Crédito'}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.queryByText('Cronograma de cuotas')).toBeNull();
});
