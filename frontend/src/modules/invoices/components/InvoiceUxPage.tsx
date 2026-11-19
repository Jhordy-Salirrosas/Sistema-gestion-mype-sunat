import type { ComponentProps } from 'react';
import { Page } from '@/components/ui';
import './invoiceUx.css';
/** Variante de presentación exclusiva de facturación: no modifica tokens globales. */
export function InvoiceUxPage({ className = '', ...props }: ComponentProps<typeof Page>) {
 return <Page className={`m1-ux min-w-0 ${className}`} {...props} />;
}
