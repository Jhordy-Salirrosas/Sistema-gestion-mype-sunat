import { useAuthStore } from '@/stores/authStore';

/**
 * Custom hook para acceder a la sesión, datos de empresa activa y permisos RBAC.
 */
export const useAuth = () => {
  const { user, token, activeCompany, isAuthenticated, setSession, setActiveCompany, logout } =
    useAuthStore();

  const role = user?.role;
  const isAdmin = role === 'ADMIN';
  return {
    user,
    token,
    accessToken: token,
    activeCompany,
    isAuthenticated,
    role,
    isAdmin,
    setSession,
    setActiveCompany,
    logout,
  };
};
