import { useRolePermissions } from '@/hooks/useRolePermissions';
export const INVOICE_WRITE_DENIED = 'Su rol no permite emitir ni operar envíos de facturación.';
export function useInvoiceWritePermission(): boolean {
  const { canEmitInvoices, isReadOnly } = useRolePermissions();
  return canEmitInvoices && !isReadOnly;
}
