import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppRoutes } from '@/routes/appRoutes';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/stores/authStore';
import type { Role } from '@/modules/auth/types/auth.types';
import { masterDataApi, type BusinessPartnerRecord } from '@/modules/customs/services/masterDataApi';

vi.mock('@/components/layout/AppLayout', () => ({ AppLayout: () => <Outlet /> }));
vi.mock('@/modules/customs/services/masterDataApi', () => ({ masterDataApi: { getPartners: vi.fn(), getPartner: vi.fn(), createPartner: vi.fn(), updatePartner: vi.fn(), deletePartner: vi.fn() } }));
const partner: BusinessPartnerRecord = { id: 'p1', company_id: 'c', doc_type: '6', doc_number: '20100070970', legal_name: 'Empresa del maestro', country_code: 'PE', roles: ['CLIENTE', 'PROVEEDOR'], is_active: true };
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([partner]);
  vi.mocked(masterDataApi.createPartner).mockResolvedValue(partner);
  vi.mocked(masterDataApi.updatePartner).mockResolvedValue(partner);
  vi.mocked(masterDataApi.getPartner).mockResolvedValue({ ...partner, addresses: [], contacts: [], bank_accounts: [] });
});
afterEach(() => { cleanup(); client.clear(); useAuthStore.getState().logout(); vi.resetAllMocks(); });
function HistoryProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="pathname">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Volver atrás</button></>;
}
function mount(role: Role, path = '/invoices/clientes') {
  useAuthStore.getState().setSession('test-token', { id: 'u', role, email: 'test@example.com', fullName: 'Usuario' });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/invoices/clientes?previous=1', path]} initialIndex={1}><Link to="/invoices/clientes">Abrir clientes</Link><HistoryProbe /><Sidebar /><AppRoutes /></MemoryRouter></QueryClientProvider>);
}
it.each(['ADMIN', 'OPERADOR_FACTURACION', 'OPERATOR'] as Role[])('%s accede a Clientes con filtro y alta inicial CLIENTE, edita y no elimina', async (role) => {
  mount(role);
  expect(await screen.findByRole('heading', { name: 'Clientes y proveedores' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Clientes/ }).getAttribute('href')).toBe('/invoices/clientes');
  expect(masterDataApi.getPartners).toHaveBeenCalledWith({ role: 'CLIENTE', q: undefined });
  expect(await screen.findByTitle('Editar tercero')).toBeTruthy();
  expect(screen.queryByTitle('Eliminar tercero')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo tercero' }));
  expect((screen.getByLabelText('CLIENTE') as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText('PROVEEDOR') as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByTitle('Editar tercero'));
  fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Empresa editada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(masterDataApi.updatePartner).toHaveBeenCalledWith(partner.id, expect.objectContaining({ legalName: 'Empresa editada', roles: ['CLIENTE', 'PROVEEDOR'] })));
});
it.each(['CONTADOR', 'ACCOUNTANT', 'AUDITOR'] as Role[])('%s tiene lectura, incluida la ficha de direcciones, contactos y bancos', async (role) => {
  mount(role);
  expect(await screen.findByRole('heading', { name: 'Clientes y proveedores' })).toBeTruthy();
  expect(await screen.findByText('Empresa del maestro')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Nuevo tercero' })).toBeNull();
  expect(screen.queryByTitle('Editar tercero')).toBeNull();
  expect(screen.queryByTitle('Eliminar tercero')).toBeNull();
  fireEvent.click(screen.getByTitle('Ver ficha técnica y cuentas'));
  await screen.findByRole('dialog');
  for (const tab of ['Direcciones', 'Contactos', 'Bancos']) {
    fireEvent.click(await screen.findByRole('button', { name: tab }));
    expect(screen.queryByRole('button', { name: /Agregar dirección|Agregar contacto|Agregar cuenta/ })).toBeNull();
  }
});
it('rechaza un rol fuera de M1', async () => {
  mount('OPERADOR_ADUANAS');
  expect(await screen.findByText('Módulo Restringido')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Clientes y proveedores' })).toBeNull();
  expect(masterDataApi.getPartners).not.toHaveBeenCalled();
});
it('redirige la URL antigua con reemplazo, sin montar el contexto aduanero ni crear bucles', async () => {
  mount('ADMIN', '/customs/partners');
  await screen.findByRole('heading', { name: 'Clientes y proveedores' });
  expect(screen.getByTestId('pathname').textContent).toBe('/invoices/clientes');
  expect(masterDataApi.getPartners).toHaveBeenCalledTimes(1);
  expect(masterDataApi.getPartners).toHaveBeenCalledWith({ role: 'CLIENTE', q: undefined });
  expect(screen.queryByTitle('Eliminar tercero')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Volver atrás' }));
  await waitFor(() => expect(screen.getByTestId('pathname').textContent).toBe('/invoices/clientes?previous=1'));
  expect(masterDataApi.getPartners).toHaveBeenCalledTimes(1);
});
it.each(['OPERADOR_ADUANAS', 'OPERADOR_FACTURACION', 'CONTADOR', 'AUDITOR', 'OPERATOR', 'ACCOUNTANT'] as Role[])('la URL antigua sigue rechazando a %s aunque tenga acceso al destino', async (role) => {
  mount(role, '/customs/partners');
  await screen.findByText('Módulo Restringido');
  expect(screen.getByTestId('pathname').textContent).toBe('/customs/partners');
  expect(masterDataApi.getPartners).not.toHaveBeenCalled();
});
it('ofrece una única casa del maestro en Facturación y ninguna entrada en Importaciones', async () => {
  mount('ADMIN');
  await screen.findByRole('heading', { name: 'Clientes y proveedores' });
  const links = screen.getAllByRole('link', { name: 'Clientes y proveedores' });
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('href')).toBe('/invoices/clientes');
  expect(screen.getByRole('button', { name: 'Facturación UBL 2.1' }).parentElement?.contains(links[0])).toBe(true);
  expect(screen.getByRole('button', { name: 'Importaciones' })).toBeTruthy();
  expect(screen.queryByText('Proveedores internacionales')).toBeNull();
  expect(document.querySelector('a[href="/customs/partners"]')).toBeNull();
});
it('consulta todos los roles desde el contexto de Facturación', async () => {
  mount('ADMIN');
  await screen.findByRole('heading', { name: 'Clientes y proveedores' });
  for (const role of ['Todos', 'CLIENTE', 'PROVEEDOR', 'IMPORTADOR', 'AGENTE', 'TRANSPORTISTA']) {
    fireEvent.click(screen.getByRole('button', { name: role }));
    await waitFor(() => expect(masterDataApi.getPartners).toHaveBeenLastCalledWith({ role: role === 'Todos' ? undefined : role, q: undefined }));
  }
});
it.each([{ roles: ['PROVEEDOR'] }, { roles: ['PROVEEDOR', 'IMPORTADOR', 'AGENTE', 'TRANSPORTISTA'] }])('crea terceros con roles $roles sin forzar CLIENTE', async ({ roles }) => {
  mount('ADMIN');
  await screen.findByRole('heading', { name: 'Clientes y proveedores' });
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo tercero' }));
  fireEvent.click(screen.getByLabelText('CLIENTE'));
  for (const role of roles) fireEvent.click(screen.getByLabelText(role));
  fireEvent.change(screen.getByLabelText('Número'), { target: { value: '20555555555' } });
  fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Proveedor nuevo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar tercero' }));
  await waitFor(() => expect(masterDataApi.createPartner).toHaveBeenCalledWith(expect.objectContaining({ docNumber: '20555555555', roles })));
  expect(screen.queryByTitle('Eliminar tercero')).toBeNull();
});
it('edita y guarda un proveedor sin CLIENTE y conserva su ficha', async () => {
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([{ ...partner, roles: ['PROVEEDOR'] }]);
  mount('ADMIN');
  fireEvent.click(await screen.findByTitle('Editar tercero'));
  expect((screen.getByLabelText('CLIENTE') as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(masterDataApi.updatePartner).toHaveBeenCalledWith(partner.id, expect.objectContaining({ roles: ['PROVEEDOR'] })));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByTitle('Ver ficha técnica y cuentas'));
  await screen.findByRole('dialog');
  expect(masterDataApi.getPartner).toHaveBeenCalledWith(partner.id);
  expect(screen.queryByTitle('Eliminar tercero')).toBeNull();
});
