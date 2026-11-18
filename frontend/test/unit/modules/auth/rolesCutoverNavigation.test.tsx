import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { RoleProtectedRoute } from '@/routes/RoleProtectedRoute';
import { permissionsApi } from '@/modules/auth/services/permissionsApi';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { serverSnapshot } from '../../../fixtures/permissionsServer';
const paths = ['/inventory/adjustments', '/inventory/opening'];
let q: QueryClient;
beforeEach(() => {
  q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  useUiStore.getState().setSidebarCollapsed(false);
});
afterEach(() => { cleanup(); q.clear(); vi.restoreAllMocks(); useAuthStore.setState({ token: null, user: null, activeCompany: null }); });
function session(role: string, allow: boolean) {
  useAuthStore.setState({ token: 'local-session', user: { id: 'actor', role, email: 'actor@example.invalid', companyId: 'local' }, activeCompany: null });
  const snapshot = serverSnapshot();
  vi.mocked(permissionsApi.mine).mockResolvedValue({ ...snapshot,
    modules: snapshot.modules.map(m => ({ ...m, canView: allow && m.moduleCode === 'M6', canWrite: allow && m.moduleCode === 'M6' })),
    menus: snapshot.menus.map(m => ({ ...m, canView: allow && paths.includes(m.path) })),
    customRolesEnabled: true,
  });
}
function renderAt(path: string) {
  render(<QueryClientProvider client={q}><MemoryRouter initialEntries={[path]}><Sidebar /><CommandPalette /><RoleProtectedRoute><span>Página autorizada</span></RoleProtectedRoute></MemoryRouter></QueryClientProvider>);
}
it.each(paths)('un rol propio autorizado ve %s en sidebar, paleta y ruta directa', async path => {
  session('GESTOR_INVENTARIO', true); renderAt(path);
  expect(await screen.findByText('Página autorizada')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Ajustes y toma física/ })).toHaveAttribute('href', paths[0]);
  expect(screen.getByRole('link', { name: /Saldo inicial/ })).toHaveAttribute('href', paths[1]);
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const palette = await screen.findByRole('dialog');
  expect(within(palette).getByText('Ajustes y toma física')).toBeInTheDocument();
  expect(within(palette).getByText('Saldo inicial')).toBeInTheDocument();
});
it.each(['ADMIN', 'CONTADOR', 'OPERADOR_FACTURACION', 'OPERADOR_ADUANAS', 'AUDITOR'])('%s sigue la concesión del servidor para ambos menús', async role => {
  session(role, true); renderAt(paths[0]);
  expect(await screen.findByText('Página autorizada')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Ajustes y toma física/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Saldo inicial/ })).toBeInTheDocument();
});
it.each(['GESTOR_INVENTARIO', 'ADMIN'])('%s no recibe menús ni ruta si el servidor los deniega', async role => {
  session(role, false); renderAt(paths[0]);
  await screen.findByText('Módulo Restringido');
  await waitFor(() => expect(screen.queryByRole('link', { name: /Ajustes y toma física/ })).toBeNull());
  expect(screen.queryByRole('link', { name: /Saldo inicial/ })).toBeNull();
  expect(screen.queryByText('Página autorizada')).toBeNull();
});
