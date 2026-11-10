import { it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';
import { InvoiceForcedResend } from '@/modules/invoices/components/InvoiceForcedResend';
import { apiClient } from '@/lib/axios';
vi.mock('@/lib/axios', () => ({ apiClient: { post: vi.fn() } }));
afterEach(() => { cleanup(); useAuthStore.setState({ user: null }); vi.resetAllMocks(); });
it('6I exige ADMIN, motivo y confirmación sin llamadas implícitas', async () => {
 const view = render(<InvoiceForcedResend id="id" incierto />); expect(screen.queryByRole('button')).toBeNull();
 useAuthStore.setState({ user: { id: 'admin', email: 'a@local', role: 'ADMIN' } }); view.rerender(<InvoiceForcedResend id="id" incierto />);
 const b = screen.getByRole('button'); expect((b as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Motivo del reenvío forzado'), { target: { value: 'Decisión de Jhordy registrada' } }); expect((b as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('checkbox')); vi.mocked(apiClient.post).mockResolvedValue({ data: { mensaje: 'Decisión registrada', resultadoCola: 'ENCOLADO' } }); fireEvent.click(b);
 await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/invoices/id/forzar-reenvio', { motivo: 'Decisión de Jhordy registrada', confirmado: true })); expect(await screen.findByRole('status')).toBeTruthy();
});
