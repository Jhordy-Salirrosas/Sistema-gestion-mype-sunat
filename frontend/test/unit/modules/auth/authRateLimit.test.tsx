import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LoginForm } from '@/modules/auth/components/LoginForm';
import { authApi } from '@/modules/auth/services/authApi';
import { permissionsApi } from '@/modules/auth/services/permissionsApi';
import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';
import { RoleProtectedRoute } from '@/routes/RoleProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
import { RATE_LIMIT_MESSAGE } from '@/lib/apiErrors';
import { serverSnapshot } from '../../../fixtures/permissionsServer';

const clients: QueryClient[] = [];
function provider() {
  const q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  clients.push(q);
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={q}><MemoryRouter initialEntries={['/sales/pos']}>{children}</MemoryRouter></QueryClientProvider>;
  return { q, Wrapper };
}
function limited(headers?: Record<string, string>) {
  return { response: { status: 429, headers, data: { message: 'Credenciales de acceso incorrectas' } } };
}
beforeEach(() => {
  useAuthStore.setState({ token: 'session', user: { id: 'actor', role: 'ADMIN', email: 'actor@example.invalid', companyId: 'company' }, activeCompany: null });
  vi.mocked(permissionsApi.mine).mockReset();
});
afterEach(() => {
  cleanup(); clients.splice(0).forEach(q => q.clear()); vi.useRealTimers(); vi.restoreAllMocks();
  useAuthStore.setState({ token: null, user: null, activeCompany: null });
});
it.each([429, 401])('login HTTP %s muestra el mensaje correspondiente', async status => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const login = vi.spyOn(authApi, 'login').mockRejectedValue(status === 429 ? limited() : { response: { status, data: { message: 'Unauthorized' } } });
  const { Wrapper } = provider(); render(<LoginForm />, { wrapper: Wrapper });
  fireEvent.change(screen.getByLabelText('Correo Corporativo'), { target: { value: 'actor@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Password123!#' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
  await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
  if (status === 429) {
    expect(await screen.findByText(RATE_LIMIT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/Credenciales de acceso incorrectas/)).toBeNull();
  } else {
    expect(await screen.findByText('Credenciales de acceso incorrectas o cuenta inactiva. Verifica tus datos.')).toBeInTheDocument();
    expect(screen.queryByText(RATE_LIMIT_MESSAGE)).toBeNull();
  }
});
it('permisos 429 muestra el aviso honesto sin atribuirlo al despertar del servidor', async () => {
  vi.mocked(permissionsApi.mine).mockRejectedValue(limited());
  const { Wrapper } = provider(); render(<RoleProtectedRoute><span>Contenido privado</span></RoleProtectedRoute>, { wrapper: Wrapper });
  expect(await screen.findByText(RATE_LIMIT_MESSAGE)).toBeInTheDocument();
  expect(screen.queryByText(/servidor esté despertando/)).toBeNull();
  expect(screen.queryByText('Contenido privado')).toBeNull();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();
});
it('otros errores de permisos conservan su presentación genérica', async () => {
  vi.mocked(permissionsApi.mine).mockRejectedValue({ response: { status: 503 } });
  const { Wrapper } = provider(); render(<RoleProtectedRoute />, { wrapper: Wrapper });
  expect(await screen.findByText('No se pudieron consultar los permisos.')).toBeInTheDocument();
  expect(screen.getByText(/servidor esté despertando/)).toBeInTheDocument();
});
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}
it.each(['seconds', 'date', 'missing'] as const)('pausa y reanuda permisos con Retry-After %s', async mode => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
  const delay = mode === 'missing' ? 60_000 : 120_000;
  const headers: Record<string, string> | undefined = mode === 'seconds' ? { 'retry-after': '120' } : mode === 'date' ? { 'Retry-After': new Date(Date.now() + delay).toUTCString() } : undefined;
  vi.mocked(permissionsApi.mine).mockRejectedValueOnce(limited(headers)).mockImplementation(async () => serverSnapshot());
  const { Wrapper } = provider(); const h = renderHook(() => useServerPermissions(), { wrapper: Wrapper });
  await advance(0);
  expect(h.result.current.errorStatus).toBe(429);
  expect(h.result.current.canNavigate('/sales/pos')).toBe(false);
  await advance(30_000); expect(permissionsApi.mine).toHaveBeenCalledTimes(1);
  // Un nuevo observador y un reintento manual no evitan la pausa compartida.
  const second = renderHook(() => useServerPermissions(), { wrapper: Wrapper });
  await act(async () => { await second.result.current.refetch(); }); await advance(0);
  expect(permissionsApi.mine).toHaveBeenCalledTimes(1);
  await advance(delay - 30_001); expect(permissionsApi.mine).toHaveBeenCalledTimes(1);
  await advance(1); expect(permissionsApi.mine).toHaveBeenCalledTimes(2);
  await advance(1);
  expect(h.result.current.ready).toBe(true);
  await advance(30_000); expect(permissionsApi.mine).toHaveBeenCalledTimes(3);
});
it('la pausa no se comparte con otra empresa', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
  vi.mocked(permissionsApi.mine).mockRejectedValueOnce(limited()).mockImplementation(async () => serverSnapshot());
  const { Wrapper } = provider(); const h = renderHook(() => useServerPermissions(), { wrapper: Wrapper });
  await advance(0); expect(h.result.current.errorStatus).toBe(429);
  await act(async () => { useAuthStore.setState({ activeCompany: { tenantId: 'other', ruc: '', razonSocial: 'Otra empresa' } }); });
  await advance(0); expect(permissionsApi.mine).toHaveBeenCalledTimes(2); expect(h.result.current.ready).toBe(true);
});
