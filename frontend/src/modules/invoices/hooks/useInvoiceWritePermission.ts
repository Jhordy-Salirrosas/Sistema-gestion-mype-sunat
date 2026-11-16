import { useQuery } from '@tanstack/react-query';
import { modulePermissionsApi } from '@/modules/auth/services/modulePermissionsApi';
import { usePermissionsIdentity } from '@/modules/auth/hooks/usePermissionsIdentity';
export const INVOICE_WRITE_DENIED = 'Su rol no permite emitir ni operar envíos de facturación.';

export function useInvoiceWritePermission(): boolean {
  const { user, scope } = usePermissionsIdentity();
  const query = useQuery({ queryKey: ['module-permissions-me', ...scope], queryFn: modulePermissionsApi.mine, enabled: Boolean(user), retry: false, staleTime: 30_000 });
  const row = Array.isArray(query.data) ? query.data.find(permission => permission.moduleCode === 'M1') : undefined;
  // La matriz efectiva viene del servidor. Se conservan, además, los roles
  // operativos que los endpoints M1 exigen mediante @Roles en el back.
  return Boolean(user) && query.isSuccess && row?.canWrite === true && ['ADMIN', 'OPERADOR_FACTURACION'].includes(row.role);
}
