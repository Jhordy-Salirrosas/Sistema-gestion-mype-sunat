import type { ComponentProps } from 'react';
import { Button } from '@/components/ui';
import { useActionPermissions } from '@/modules/auth/hooks/useActionPermissions';
import type { ActionCode } from '@/modules/auth/services/actionPermissionsApi';
import { INVOICE_WRITE_DENIED, useInvoiceWritePermission } from '../hooks/useInvoiceWritePermission';
/** Añade permisos del servidor a las condiciones operativas existentes. */
export function InvoiceWriteButton({ action, ...props }: ComponentProps<typeof Button> & { action?: ActionCode }) {
  const permitido = useInvoiceWritePermission();
  const actions = useActionPermissions();
  const accionPermitida = !action || actions.can(action);
  const disabled = !permitido || !accionPermitida || props.disabled;
  return <Button {...props} disabled={disabled} title={!permitido ? INVOICE_WRITE_DENIED : !accionPermitida ? 'No tiene permiso para esta acción.' : props.title}
    onClick={event => { if (!disabled) props.onClick?.(event); }} />;
}
