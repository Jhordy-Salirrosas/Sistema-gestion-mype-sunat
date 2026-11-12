import type { ComponentProps } from 'react';
import { Button } from '@/components/ui';
import { INVOICE_WRITE_DENIED, useInvoiceWritePermission } from '../hooks/useInvoiceWritePermission';
/** Conserva la condición operativa propia del botón y añade el permiso de facturación. */
export function InvoiceWriteButton(props: ComponentProps<typeof Button>) {
  const permitido = useInvoiceWritePermission();
  return <Button {...props} disabled={!permitido || props.disabled} title={permitido ? props.title : INVOICE_WRITE_DENIED} />;
}
