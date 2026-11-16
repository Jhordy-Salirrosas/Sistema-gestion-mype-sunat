import { useActionPermissions } from '@/modules/auth/hooks/useActionPermissions';
export const INVOICE_DATE_READONLY = 'La fecha de emisión es de solo lectura: no tiene permiso para modificarla.';
export function useInvoiceDatePermission() {
  const actions = useActionPermissions();
  const canEditDate = actions.can('INVOICE_EDIT_ISSUE_DATE');
  const explanation = canEditDate ? undefined : actions.isLoading
    ? 'Consultando el permiso para modificar la fecha de emisión.'
    : actions.isError ? 'No se pudo consultar el permiso. La fecha de emisión se conserva de solo lectura.' : INVOICE_DATE_READONLY;
  return { canEditDate, explanation };
}
