import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '@/modules/auth/services/authApi';
import { cargarEmpresaActiva } from '@/modules/auth/lib/empresaActiva';
import {
  type AuthUser,
  type ChangePasswordPayload,
  type LoginPayload,
  type RegisterPayload,
} from '@/modules/auth/types/auth.types';
import { useAuthStore } from '@/stores/authStore';

export interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (fullName: string) => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const storeUser = useAuthStore((s) => s.user);
  const storeToken = useAuthStore((s) => s.token);

  /**
   * La sesión del store MANDA sobre el estado local.
   *
   * POR QUÉ SE DERIVA EN RENDER Y NO CON UN `useEffect`
   *
   * Cuando la sesión viene de `localStorage` (una recarga), `persist` de zustand
   * todavía no ha hidratado en el primer render, así que el `useState` local
   * arranca en `null`. Si nada lo vuelve a leer, `isAuthenticated` da `false` y
   * `ProtectedRoute` manda a /login con una sesión válida guardada.
   *
   * La primera versión lo resolvía con un `useEffect` que copiaba el store al
   * estado. Funcionaba, pero provocaba renders en cascada y `react-hooks`
   * lo marca como error. Derivar en render da el mismo resultado sin efecto:
   * si el store trae token, se usa el del store; el estado local solo cubre el
   * hueco hasta que `persist` hidrata.
   */
  const [tokenLocal, setAccessToken] = useState<string | null>(storeToken);
  const [usuarioLocal, setUser] = useState<AuthUser | null>((storeUser as AuthUser) || null);

  const accessToken = storeToken ?? tokenLocal;
  const user = (storeUser as AuthUser) ?? usuarioLocal;
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restauración de sesión silenciosa (Silent Refresh on mount - F5 resilience)
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const response = await authApi.refreshToken();
        const token = response.accessToken || response.token;
        if (token && isMounted) {
          setAccessToken(token);
          setUser(response.user);
          useAuthStore.getState().setSession(token, response.user);
          // La empresa se resuelve por `/auth/profile`: ni el login ni el
          // refresh la devuelven, y sin ella la sesión quedaba sin RUC emisor.
          void cargarEmpresaActiva();
        }
      } catch {
        // Si no hay cookie válida o expiró, se intenta primero RECUPERAR la
        // sesión que el store ya tiene en memoria o en `localStorage`.
        //
        // Antes se hacía `logout()` directamente cuando el store no tenía token
        // en ese instante. El problema: al recargar la página, `persist` de
        // zustand todavía no ha hidratado cuando este `catch` se ejecuta, así
        // que el store estaba vacío y se borraba una sesión que en realidad
        // existía guardada. El resultado era entrar con el botón y salir a
        // /login en la siguiente recarga.
        const enStore = useAuthStore.getState();
        if (isMounted && enStore.token) {
          setAccessToken(enStore.token);
          if (enStore.user) setUser(enStore.user as AuthUser);
        } else if (isMounted) {
          // De verdad no hay sesión: se limpia.
          useAuthStore.getState().logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [storeToken]);

  const login = async (credentials: LoginPayload) => {
    const data = await authApi.login(credentials);
    const token = data.accessToken || data.token || '';
    setAccessToken(token);
    setUser(data.user);
    useAuthStore.getState().setSession(token, data.user);
    if (data.companies && data.companies.length > 0) {
      useAuthStore.getState().setActiveCompany(data.companies[0]);
    } else {
      // El login no trae `companies`; la empresa sale del perfil.
      await cargarEmpresaActiva(true);
    }
  };

  const register = async (payload: RegisterPayload) => {
    const data = await authApi.register(payload);
    const token = data.accessToken || data.token || '';
    setAccessToken(token);
    setUser(data.user);
    useAuthStore.getState().setSession(token, data.user);
    if (data.companies && data.companies.length > 0) {
      useAuthStore.getState().setActiveCompany(data.companies[0]);
    } else {
      await cargarEmpresaActiva(true);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignorar fallos de red en logout para garantizar la salida local
    } finally {
      setAccessToken(null);
      setUser(null);
      useAuthStore.getState().logout();
    }
  };

  const updateProfile = async (fullName: string) => {
    await authApi.updateProfile({ fullName });
    if (user) {
      const updatedUser: AuthUser = { ...user, fullName, name: fullName };
      setUser(updatedUser);
      useAuthStore.getState().updateUser(updatedUser);
    }
  };

  const changePassword = async (payload: ChangePasswordPayload) => {
    await authApi.changePassword(payload);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!accessToken,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

/**
 * Igual que `useAuthContext` pero devuelve `undefined` si no hay proveedor.
 *
 * Lo usa `ProtectedRoute`: en la aplicación siempre hay `AuthProvider`, pero en
 * una prueba de navegación se monta el guardián solo para comprobar que redirige
 * y montar medio árbol de la aplicación obligaría a simular red, token y
 * refresco para verificar una redirección.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContextOptional = (): AuthContextType | undefined =>
  useContext(AuthContext);
