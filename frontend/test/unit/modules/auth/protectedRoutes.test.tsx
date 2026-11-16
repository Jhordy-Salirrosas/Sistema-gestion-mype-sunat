import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { RoleProtectedRoute } from '@/routes/RoleProtectedRoute';
import { useAuthStore } from '@/stores/authStore';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrap = (ui: React.ReactNode) => <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;

afterEach(() => {
  cleanup();
  queryClient.clear();
  useAuthStore.getState().logout();
});

describe('Navigation Guards: ProtectedRoute & RoleProtectedRoute', () => {
  it('ProtectedRoute redirige a /login cuando el usuario no está autenticado', () => {
    useAuthStore.getState().logout();

    render(
      wrap(<MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Pantalla de Login</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Contenido Privado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>)
    );

    expect(screen.getByText('Pantalla de Login')).toBeInTheDocument();
    expect(screen.queryByText('Contenido Privado')).not.toBeInTheDocument();
  });

  it('RoleProtectedRoute bloquea con 403 Forbidden a OPERADOR_ADUANAS en rutas contables', async () => {
    useAuthStore.getState().setSession('token-valido', {
      id: 'user-1',
      email: 'aduanas@mype.pe',
      role: 'OPERADOR_ADUANAS',
      fullName: 'Operador Aduanas',
    });

    render(
      wrap(<MemoryRouter initialEntries={['/accounting']}>
        <Routes>
          <Route
            path="/accounting"
            element={
              <RoleProtectedRoute>
                <div>Libros Contables PLE</div>
              </RoleProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>)
    );

    expect(await screen.findByText('Módulo Restringido')).toBeInTheDocument();
    expect(screen.getByText(/Código 403/i)).toBeInTheDocument();
    expect(screen.getByText(/OPERADOR_ADUANAS/i)).toBeInTheDocument();
    expect(screen.queryByText('Libros Contables PLE')).not.toBeInTheDocument();
  });

  it('RoleProtectedRoute permite acceso a ADMIN en cualquier ruta protegida', async () => {
    useAuthStore.getState().setSession('token-valido', {
      id: 'admin-1',
      email: 'admin@mype.pe',
      role: 'ADMIN',
      fullName: 'Administrador General',
    });

    render(
      wrap(<MemoryRouter initialEntries={['/accounting']}>
        <Routes>
          <Route
            path="/accounting"
            element={
              <RoleProtectedRoute>
                <div>Libros Contables PLE</div>
              </RoleProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>)
    );

    expect(await screen.findByText('Libros Contables PLE')).toBeInTheDocument();
    expect(screen.queryByText('Módulo Restringido')).not.toBeInTheDocument();
  });
});
