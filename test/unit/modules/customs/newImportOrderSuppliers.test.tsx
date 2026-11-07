import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { NewImportOrderModal } from '@/modules/customs/components/NewImportOrderModal';
import { masterDataApi, type BusinessPartnerRecord } from '@/modules/customs/services/masterDataApi';

vi.mock('@/modules/customs/services/masterDataApi', () => ({ masterDataApi: { getPartners: vi.fn(), getPartner: vi.fn(), getCurrencies: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
it('resuelve proveedor y banco por API dentro del modal, sin navegar al maestro', async () => {
  const supplier: BusinessPartnerRecord = { id: 'supplier-1', company_id: 'c', doc_type: '0', doc_number: 'TAX-123', legal_name: 'Proveedor exterior', country_code: 'CN', address: 'Shanghai 123', roles: ['PROVEEDOR'], is_active: true };
  vi.mocked(masterDataApi.getPartners).mockResolvedValue([supplier]);
  vi.mocked(masterDataApi.getCurrencies).mockResolvedValue([]);
  vi.mocked(masterDataApi.getPartner).mockResolvedValue({ ...supplier, addresses: [], contacts: [], bank_accounts: [{ id: 'b', bank_country: 'CN', bank_name: 'Banco exterior', account_number: '123', swift: 'SWIFT123', currency_code: 'USD', is_default: true }] });
  render(<MemoryRouter initialEntries={['/customs/orders']}><Location /><NewImportOrderModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} /></MemoryRouter>);
  const option = await screen.findByRole('option', { name: 'Proveedor exterior (CN - TAX-123)' });
  fireEvent.change(option.closest('select')!, { target: { value: supplier.id } });
  expect(masterDataApi.getPartners).toHaveBeenCalledWith({ role: 'PROVEEDOR' });
  await waitFor(() => expect(masterDataApi.getPartner).toHaveBeenCalledWith(supplier.id));
  expect(screen.getByDisplayValue(supplier.legal_name)).toBeTruthy();
  expect(screen.getByDisplayValue(supplier.doc_number)).toBeTruthy();
  expect(screen.getByDisplayValue(supplier.address!)).toBeTruthy();
  await screen.findByTitle('Banco exterior - SWIFT: SWIFT123');
  expect(screen.getByTestId('location').textContent).toBe('/customs/orders');
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
});
