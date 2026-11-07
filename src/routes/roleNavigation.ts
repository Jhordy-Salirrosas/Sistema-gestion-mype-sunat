import { type Role } from '@/modules/auth/types/auth.types';

/**
 * Retorna la ruta inicial autorizada según la Matriz RBAC del rol activo.
 * - OPERADOR_ADUANAS -> /customs (Aduanas DUA & Kardex)
 * - CONTADOR -> /accounting (Contabilidad PCGE & PLE) o /sire
 * - OPERADOR_FACTURACION -> /invoices (Facturación UBL 2.1)
 * - ADMIN / AUDITOR -> /invoices (Acceso general)
 */
export const getDefaultRouteForRole = (role?: Role): string => {
  switch (role) {
    case 'OPERADOR_ADUANAS':
      return '/customs';
    case 'CONTADOR':
    case 'ACCOUNTANT':
      return '/accounting';
    case 'OPERADOR_FACTURACION':
    case 'OPERATOR':
      return '/invoices';
    case 'ADMIN':
    case 'AUDITOR':
    default:
      return '/invoices';
  }
};
