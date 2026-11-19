import PartnersPage from '@/modules/customs/pages/PartnersPage';
import { InvoiceUxPage } from '../components/InvoiceUxPage';
/** Variante visual M1; conserva el maestro y sus reglas sin alterar otros módulos. */
export default function InvoiceClientsPage(){return <InvoiceUxPage><PartnersPage key="billing" context="billing"/></InvoiceUxPage>;}
