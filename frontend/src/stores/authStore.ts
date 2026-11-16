import { normalizeRoleCode } from '@/modules/auth/lib/roleCode';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type AuthUser, type Role } from '@/modules/auth/types/auth.types';

export interface UserSession extends Partial<AuthUser> {
  id: string;
  name?: string;
  fullName?: string;
  email: string;
  role: Role;
}

export interface ActiveCompany {
  tenantId: string;
  ruc: string;
  razonSocial: string;
  regimen?: 'MYPE_TRIBUTARIO' | 'GENERAL' | 'ESPECIAL' | 'RUS';
}

interface AuthState {
  token: string | null;
  user: UserSession | null;
  activeCompany: ActiveCompany | null;
  isAuthenticated: boolean;

  // Acciones
  setSession: (token: string, user: UserSession) => void;
  setToken: (token: string) => void;
  updateUser: (userUpdates: Partial<UserSession>) => void;
  setActiveCompany: (company: ActiveCompany) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      activeCompany: null,
      isAuthenticated: false,

      setSession: (token, user) =>
        set({
          token,
          user: {
            ...user,
            role: normalizeRoleCode(user.role),
            fullName: user.fullName || user.name || '',
            name: user.name || user.fullName || '',
          },
          isAuthenticated: true,
        }),

      setToken: (token) =>
        set({
          token,
          isAuthenticated: !!token,
        }),

      updateUser: (userUpdates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdates } : null,
        })),

      setActiveCompany: (activeCompany) =>
        set({
          activeCompany,
        }),

      logout: () =>
        set({
          token: null,
          user: null,
          activeCompany: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'sync-sunat-auth',
      merge: (persisted, current) => { const saved=persisted as Partial<AuthState>; return {...current,...saved,user:saved.user?{...saved.user,role:normalizeRoleCode(saved.user.role)}:null}; },
    }
  )
);
