import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import type { MedioPagoVenta } from '../types/invoiceEmision.types';
export interface CommercialDefaults { forma_pago: 'Contado' | 'Credito'; medio_pago: MedioPagoVenta }
export function useCommercialDefaults() {
  const company = useAuthStore(s => s.activeCompany?.tenantId);
  const user = useAuthStore(s => s.user?.id);
  return useQuery({ queryKey: ['invoice-commercial-defaults', company, user],
    queryFn: async () => { const data = (await apiClient.get<CommercialDefaults>('/invoices/commercial-defaults')).data; if (!data || !['Contado','Credito'].includes(data.forma_pago) || !['EFECTIVO','YAPE','PLIN','TARJETA','TRANSFERENCIA','DEPOSITO','CHEQUE'].includes(data.medio_pago)) throw Error('Configuración comercial inválida'); return data; },
    staleTime: 30000, retry: false, refetchOnWindowFocus: false });
}
/** El cliente solo habilita crédito; nunca decide el predeterminado empresarial. */
export function permittedDefault(defaults: CommercialDefaults | undefined, credit: boolean, tipo: string) {
  return defaults?.forma_pago === 'Credito' && credit && tipo === '01' ? 'Credito' : 'Contado';
}
