import { useAuthStore } from '@/stores/authStore';
import { type Role } from '@/modules/auth/types/auth.types';

/**
 * Custom hook para acceder a la sesión, datos de empresa activa y permisos RBAC.
 */
export const useAuth = () => {
  const { user, token, activeCompany, isAuthenticated, setSession, setActiveCompany, logout } =
    useAuthStore();

  const role = user?.role;
  const isAdmin = role === 'ADMIN';
  const isAccountant = role === 'CONTADOR' || role === 'ACCOUNTANT' || isAdmin;
  const isBillingOperator = role === 'OPERADOR_FACTURACION' || isAdmin;
  const isCustomsOperator = role === 'OPERADOR_ADUANAS' || isAdmin;
  const isAuditor = role === 'AUDITOR' || isAdmin;
  const isOperator = isBillingOperator || isCustomsOperator || isAccountant;

  const hasRole = (allowedRoles: Role[] | Role): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;

    const rolesList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return rolesList.includes(user.role);
  };

  return {
    user,
    token,
    accessToken: token,
    activeCompany,
    isAuthenticated,
    role,
    isAdmin,
    isAccountant,
    isBillingOperator,
    isCustomsOperator,
    isAuditor,
    isOperator,
    hasRole,
    setSession,
    setActiveCompany,
    logout,
  };
};
