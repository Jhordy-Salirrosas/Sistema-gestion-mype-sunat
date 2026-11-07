import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Outlet } from 'react-router-dom';
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
  vi.mocked(masterDataApi.getPartner).mockResolvedValue({ ...partner, addresses: [], contacts: [], bank_accounts: [] });
});
afterEach(() => { cleanup(); client.clear(); useAuthStore.getState().logout(); vi.resetAllMocks(); });
function mount(role: Role, path = '/invoices/clientes') {
  useAuthStore.getState().setSession('test-token', { id: 'u', role, email: 'test@example.com', fullName: 'Usuario' });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Link to="/invoices/clientes">Abrir clientes</Link><Sidebar /><AppRoutes /></MemoryRouter></QueryClientProvider>);
}
it.each(['ADMIN', 'OPERADOR_FACTURACION', 'OPERATOR'] as Role[])('%s accede a Clientes con filtro y alta inicial CLIENTE, edita y no elimina', async (role) => {
  mount(role);
  expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Clientes/ }).getAttribute('href')).toBe('/invoices/clientes');
  expect(masterDataApi.getPartners).toHaveBeenCalledWith({ role: 'CLIENTE', q: undefined });
  expect(await screen.findByTitle('Editar tercero')).toBeTruthy();
  expect(screen.queryByTitle('Eliminar tercero')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
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
  expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeTruthy();
  expect(await screen.findByText('Empresa del maestro')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).toBeNull();
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
  expect(screen.queryByRole('heading', { name: 'Clientes' })).toBeNull();
  expect(masterDataApi.getPartners).not.toHaveBeenCalled();
});
it('conserva todos los roles, alta inicial PROVEEDOR y eliminación en el maestro aduanero', async () => {
  mount('ADMIN', '/customs/partners');
  expect(await screen.findByRole('heading', { name: 'Clientes y proveedores' })).toBeTruthy();
  expect(masterDataApi.getPartners).toHaveBeenCalledWith({ role: undefined, q: undefined });
  expect(await screen.findByTitle('Eliminar tercero')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo tercero' }));
  expect((screen.getByLabelText('PROVEEDOR') as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText('CLIENTE') as HTMLInputElement).checked).toBe(false);
});

it('reinicia el filtro al navegar del maestro aduanero al contexto de Facturación', async () => {
  mount('ADMIN', '/customs/partners');
  await screen.findByRole('heading', { name: 'Clientes y proveedores' });
  fireEvent.click(screen.getByRole('button', { name: 'PROVEEDOR' }));
  await waitFor(() => expect(masterDataApi.getPartners).toHaveBeenCalledWith({ role: 'PROVEEDOR', q: undefined }));
  fireEvent.click(screen.getByRole('link', { name: 'Abrir clientes' }));
  await screen.findByRole('heading', { name: 'Clientes' });
  await waitFor(() => expect(masterDataApi.getPartners).toHaveBeenLastCalledWith({ role: 'CLIENTE', q: undefined }));
});
