import { it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoiceSeriesForm } from '@/modules/invoices/components/InvoiceSeriesForm';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn() } }));
afterEach(() => { cleanup(); useAuthStore.setState({ user: null }); vi.resetAllMocks(); });
it('6F solo ADMIN ve la gestión de series', () => { render(<InvoiceSeriesForm />); expect(screen.queryByRole('form')).toBeNull(); });
it('6F crea por endpoint existente, conserva contrato de correlativo y refresca lista', async () => {
 useAuthStore.setState({ user: { id: 'a', email: 'a@local', role: 'ADMIN' } }); vi.mocked(apiClient.post).mockResolvedValue({ data: {} }); const saved = vi.fn();
 render(<InvoiceSeriesForm onSaved={saved} />); fireEvent.change(screen.getByLabelText('Nueva serie'), { target: { value: 'FC02' } }); fireEvent.change(screen.getByLabelText('Tipo de la serie'), { target: { value: '07' } }); fireEvent.submit(screen.getByRole('form'));
 await waitFor(() => expect(saved).toHaveBeenCalledTimes(1)); expect(apiClient.post).toHaveBeenCalledWith('/invoices/series', { document_type: '07', series: 'FC02', correlativo_inicial: 0 });
 expect(await screen.findByRole('status')).toBeTruthy();
});
