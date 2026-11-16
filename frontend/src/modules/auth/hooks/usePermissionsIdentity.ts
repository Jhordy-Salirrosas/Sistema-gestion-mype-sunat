import { useAuth } from '@/hooks/useAuth';

/** La caché efectiva no se comparte entre sesiones, roles ni empresas. */
export function usePermissionsIdentity() {
  const { user, activeCompany } = useAuth();
  const scope = [activeCompany?.tenantId ?? user?.companyId ?? null, user?.id ?? null, user?.role ?? null] as const;
  return { user, scope };
}
