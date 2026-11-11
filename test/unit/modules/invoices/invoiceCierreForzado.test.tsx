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
 await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/invoices/id/forzar-reenvio', expect.objectContaining({ motivo: 'Decisión de Jhordy registrada', confirmado: true, decisionId: expect.any(String) }))); expect(await screen.findByRole('status')).toBeTruthy();
});

it('7J conserva la identidad al repetir y exige renovar motivo/confirmación para otra decisión', async () => {
 useAuthStore.setState({ user: { id: 'admin', email: 'a@local', role: 'ADMIN' } });
 vi.mocked(apiClient.post).mockResolvedValue({ data: { mensaje: 'Consumida', resultadoCola: 'AUTORIZACION_CONSUMIDA', autorizacionId: 'auth-1', requiereNuevaDecision: true } });
 render(<InvoiceForcedResend id="id" incierto />);
 fireEvent.change(screen.getByLabelText('Motivo del reenvío forzado'), { target: { value: 'Primera decisión' } }); fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button', { name: 'Autorizar reenvío forzado' })); await screen.findByText(/Preparar una nueva decisión/);
 const first = vi.mocked(apiClient.post).mock.calls[0][1] as { decisionId: string };
 fireEvent.click(screen.getByRole('button', { name: 'Autorizar reenvío forzado' })); await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
 expect((vi.mocked(apiClient.post).mock.calls[1][1] as { decisionId: string }).decisionId).toBe(first.decisionId);
 await waitFor(() => expect((screen.getByRole('button', { name: 'Preparar una nueva decisión explícita' }) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.click(screen.getByRole('button', { name: 'Preparar una nueva decisión explícita' }));
 expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
 expect((screen.getByLabelText('Motivo del reenvío forzado') as HTMLTextAreaElement).value).toBe('');
 fireEvent.change(screen.getByLabelText('Motivo del reenvío forzado'), { target: { value: 'Otra decisión expresa' } }); fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button', { name: 'Autorizar reenvío forzado' })); await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(3));
 const renewed = vi.mocked(apiClient.post).mock.calls[2][1] as { decisionId: string; renovarAutorizacionId: string };
 expect(renewed.decisionId).not.toBe(first.decisionId); expect(renewed.renovarAutorizacionId).toBe('auth-1');
});
