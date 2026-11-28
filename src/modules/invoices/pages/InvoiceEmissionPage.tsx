import { PageHeader } from '@/components/ui';
import { InvoiceUxPage as Page } from '../components/InvoiceUxPage';
import { InvoiceEmissionForm } from '../components/InvoiceEmissionForm';

export default function InvoiceEmissionPage() {
  return <Page>
    <PageHeader title="Emisión de Comprobantes Electrónicos"
      description="Facturas y boletas con detalle de varias líneas, stock validado y liquidación real" />
    <InvoiceEmissionForm />
  </Page>;
}
