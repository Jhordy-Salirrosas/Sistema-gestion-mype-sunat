import { useAuth } from './useAuth';
import { type Role } from '@/modules/auth/types/auth.types';

export interface RolePermissions {
  role: Role | undefined;
  isAdmin: boolean;
  isContador: boolean;
  isFacturador: boolean;
  isAduanas: boolean;
  isAuditor: boolean;
  canEmitInvoices: boolean;
  canRegisterDua: boolean;
  canCreateAccountingEntry: boolean;
  canExportPle: boolean;
  canReconcileSire: boolean;
  isReadOnly: boolean;
}

/**
 * Hook centralizado para evaluar capacidades y acciones operativas según la Matriz RBAC.
 * Referencia: docs/especificacionAuth.md § 7.1
 */
export const useRolePermissions = (): RolePermissions => {
  const { user } = useAuth();
  const role = user?.role;

  const isAdmin = role === 'ADMIN';
  const isContador = role === 'CONTADOR' || role === 'ACCOUNTANT';
  const isFacturador = role === 'OPERADOR_FACTURACION' || role === 'OPERATOR';
  const isAduanas = role === 'OPERADOR_ADUANAS';
  const isAuditor = role === 'AUDITOR';

  return {
    role,
    isAdmin,
    isContador,
    isFacturador,
    isAduanas,
    isAuditor,
    // Permisos de mutación / acciones operativas según rol:
    canEmitInvoices: isAdmin || isFacturador,
    canRegisterDua: isAdmin || isAduanas,
    canCreateAccountingEntry: isAdmin || isContador,
    canExportPle: isAdmin || isContador,
    canReconcileSire: isAdmin || isContador,
    isReadOnly: isAuditor,
  };
};
