import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { masterDataApi } from '@/modules/customs/services/masterDataApi';
import type { ClienteBuscado } from '../lib/invoiceSearch';
import type { FormIssue } from '../lib/invoiceFormIssues';
import { problemaIdentidadReceptor, type ReceptorRegistrado } from '../lib/invoiceReceiverIdentity';

/** Reutiliza la selección del maestro; sin ella consulta solo el documento exacto. */
export function useInvoiceReceiverIdentity(documento: string, nombre: string, seleccionado: ClienteBuscado | null, comprobante: string) {
  const company = useAuthStore(s => s.activeCompany?.tenantId);
  const user = useAuthStore(s => s.user?.id);
  const doc = documento.trim();
  const tipo = /^\d{11}$/.test(doc) ? '6' : comprobante !== '01' && /^\d{8}$/.test(doc) ? '1' : '';
  const conocido = seleccionado?.id && seleccionado.numeroDocumento.trim() === doc && seleccionado.tipoDocumento === tipo && seleccionado.razonSocial.trim()
    ? [{ doc_type: tipo, doc_number: doc, legal_name: seleccionado.razonSocial }] : undefined;
  const query = useQuery({
    queryKey: ['master-data', 'invoice-receiver-identity', company ?? null, user ?? null, tipo, doc],
    enabled: Boolean(tipo) && !conocido,
    staleTime: 30_000, retry: false, refetchOnWindowFocus: false,
    queryFn: async (): Promise<ReceptorRegistrado[]> => {
      const partners = await masterDataApi.getPartners({ q: doc });
      if (!Array.isArray(partners)) throw new Error('Respuesta del maestro no válida');
      const exactos = partners.filter(p => p && p.doc_type === tipo && p.doc_number?.trim() === doc);
      if (exactos.some(p => typeof p.legal_name !== 'string' || !p.legal_name.trim())) throw new Error('Nombre del maestro no disponible');
      return exactos;
    },
  });
  const fallo = Boolean(tipo) && !conocido && query.isError;
  let mensaje: string | undefined;
  if (tipo) {
    if (!conocido && (query.isPending || query.isFetching)) mensaje = 'Consultando la identidad del receptor en el maestro…';
    else if (fallo) mensaje = 'No se pudo verificar la identidad del receptor en el maestro. Inténtelo de nuevo.';
    else mensaje = problemaIdentidadReceptor(doc, nombre, conocido ?? query.data ?? []);
  }
  const problema: FormIssue | undefined = mensaje ? { selector: comprobante === '03' || fallo ? '#doc-cliente' : '#razon-cliente', mensaje } : undefined;
  return { problema, fallo, reintentar: query.refetch };
}
