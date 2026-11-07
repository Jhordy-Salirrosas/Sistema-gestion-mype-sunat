import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerLookupField } from '@/modules/invoices/components/CustomerLookupField';
import { RetencionMaestro } from '@/modules/invoices/components/RetencionMaestro';
import { masterDataApi, type BusinessPartnerRecord } from '@/modules/customs/services/masterDataApi';
import { apiClient } from '@/lib/axios';
import type { ClienteBuscado } from '@/modules/invoices/lib/invoiceSearch';

vi.mock('@/modules/customs/services/masterDataApi', () => ({ masterDataApi: { getPartners: vi.fn(), getPartner: vi.fn(), createPartner: vi.fn(), updatePartner: vi.fn() } }));
vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('@/hooks/useRolePermissions', () => ({ useRolePermissions: () => ({ canEmitInvoices: true }) }));
const partner: BusinessPartnerRecord = { id: 'master-42', company_id: 'c', doc_type: '6', doc_number: '20100070970', legal_name: 'Cliente maestro', address: 'Av. Lima 123', country_code: 'PE', roles: ['CLIENTE'], is_active: true };
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([]);
  vi.mocked(apiClient.get).mockResolvedValue({ data: [] } as never);
});
afterEach(() => { cleanup(); client.clear(); vi.resetAllMocks(); });
function mount(onElegir = vi.fn(), retention = false) {
  function Form() {
    const [doc, setDoc] = useState(''); const [name, setName] = useState('');
    const select = (c: ClienteBuscado) => { onElegir(c); setDoc(c.numeroDocumento); setName(c.razonSocial); };
    return <><CustomerLookupField documento={doc} razonSocial={name} onDocumentoChange={setDoc} onRazonSocialChange={setName} onElegir={select} labelDocumento="Documento" />
      {retention && <RetencionMaestro documento={doc} razonSocial={name} valor={false} onChange={vi.fn()} />}</>;
  }
  render(<QueryClientProvider client={client}><Form /></QueryClientProvider>);
  return onElegir;
}
function fill() {
  fireEvent.change(screen.getByLabelText('Documento'), { target: { value: partner.doc_number } });
  fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: partner.legal_name } });
}
it('busca en el maestro por rol CLIENTE, excluye inactivos y conserva ID, documento, nombre y dirección', async () => {
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([partner, { ...partner, id: 'inactive', legal_name: 'Cliente inactivo', is_active: false }]);
  const selected = mount();
  fireEvent.change(screen.getByLabelText('Razón social / nombre'), { target: { value: 'Cliente' } });
  fireEvent.click(await screen.findByRole('button', { name: /Cliente maestro/ }));
  expect(masterDataApi.getPartners).toHaveBeenCalledWith({ role: 'CLIENTE', q: 'Cliente' });
  expect(screen.queryByText('Cliente inactivo')).toBeNull();
  expect(selected).toHaveBeenCalledWith({ id: partner.id, tipoDocumento: '6', numeroDocumento: partner.doc_number, razonSocial: partner.legal_name, direccion: partner.address });
});
it('registra con el formulario compartido, selecciona el creado, invalida las consultas y vuelve a resolver retención', async () => {
  let created = false;
  vi.mocked(masterDataApi.createPartner).mockImplementation(async () => { created = true; return partner; });
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({ data: String(url).endsWith('/tax-status') ? [{ indicator: 'RETENCION', value: true }] : created ? [partner] : [] }) as never);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const selected = mount(vi.fn(), true); fill();
  expect(await screen.findByText(/Sin registro en el maestro/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente nuevo' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Guardar tercero' }));
  await waitFor(() => expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: partner.id })));
  expect(masterDataApi.createPartner).toHaveBeenCalledWith(expect.objectContaining({ docNumber: partner.doc_number, roles: ['CLIENTE'] }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['master-data', 'partners'] });
  expect(await screen.findByText(/según maestro: Sí/)).toBeTruthy();
});
it('ofrece añadir CLIENTE con PUT y preserva todos los roles actuales sin hacer POST', async () => {
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([{ ...partner, roles: ['PROVEEDOR'] }]);
  vi.mocked(masterDataApi.getPartner).mockResolvedValue({ ...partner, roles: ['PROVEEDOR', 'IMPORTADOR'], addresses: [], contacts: [], bank_accounts: [] });
  vi.mocked(masterDataApi.updatePartner).mockResolvedValue(partner);
  const selected = mount(); fill();
  fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente nuevo' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Guardar tercero' }));
  const add = await screen.findByRole('button', { name: 'Añadir rol CLIENTE' });
  expect(masterDataApi.updatePartner).not.toHaveBeenCalled();
  fireEvent.click(add);
  await waitFor(() => expect(masterDataApi.updatePartner).toHaveBeenCalledWith(partner.id, { roles: ['PROVEEDOR', 'IMPORTADOR', 'CLIENTE'] }));
  expect(masterDataApi.createPartner).not.toHaveBeenCalled();
  await waitFor(() => expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: partner.id })));
});
it('permite escribir un cliente no registrado y retención manual incluso si falla la búsqueda', async () => {
  vi.mocked(masterDataApi.getPartners).mockRejectedValue(new Error('red'));
  mount(vi.fn(), true); fill();
  expect(await screen.findByText(/No se pudo buscar en el maestro/)).toBeTruthy();
  expect((screen.getByLabelText('Documento') as HTMLInputElement).value).toBe(partner.doc_number);
  expect((screen.getByLabelText('Razón social / nombre') as HTMLInputElement).value).toBe(partner.legal_name);
  const manual = screen.getByRole('checkbox'); fireEvent.click(manual);
  expect(manual.hasAttribute('disabled')).toBe(false);
});
it('no reactiva ni selecciona un tercero inactivo al registrar su documento', async () => {
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([{ ...partner, is_active: false }]);
  const selected = mount(); fill();
  fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente nuevo' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Guardar tercero' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('inactivo'));
  expect(selected).not.toHaveBeenCalled();
  expect(masterDataApi.createPartner).not.toHaveBeenCalled();
  expect(masterDataApi.updatePartner).not.toHaveBeenCalled();
});
