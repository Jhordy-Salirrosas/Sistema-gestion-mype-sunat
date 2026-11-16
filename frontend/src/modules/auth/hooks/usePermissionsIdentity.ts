import { useAuthStore } from '@/stores/authStore';
import { normalizeRoleCode } from '../lib/roleCode';

/** La caché efectiva no se comparte entre sesiones, roles ni empresas. */
export function usePermissionsIdentity() {
  const { user, activeCompany } = useAuthStore();
  const scope = [activeCompany?.tenantId ?? user?.companyId ?? null, user?.id ?? null, user?.role ? normalizeRoleCode(user.role) : null] as const;
  return { user, scope };
}
