import { useServerPermissions } from '@/modules/auth/hooks/useServerPermissions';
export const INVOICE_WRITE_DENIED='Su rol no permite emitir ni operar envíos de facturación.';
export function useInvoiceWritePermission(){const p=useServerPermissions();return p.canWrite('M1')&&p.canAction('INVOICE_EMIT');}
