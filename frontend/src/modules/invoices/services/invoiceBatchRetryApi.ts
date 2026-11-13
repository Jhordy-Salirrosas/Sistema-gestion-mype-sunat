import { apiClient } from '@/lib/axios';
export interface DetalleReintentoMasivo {
  id:string; numero:string; estado:string; resultado:string; motivo:string;
}
export interface ReintentoMasivo {
  fase:'PREVIA'|'EJECUTADA'; elegibles:number; encolados:number;
  omitidos_incertidumbre:number; omitidos_rechazo_definitivo:number; omitidos_bloqueo_local:number;
  en_curso:number; ya_en_cola:number; omitidos_estado:number; no_confirmados:number; documentos:DetalleReintentoMasivo[];
}
export const invoiceBatchRetryApi = {
  previa:async():Promise<ReintentoMasivo> => (await apiClient.get<ReintentoMasivo>('/invoices/retry-batch')).data,
  ejecutar:async():Promise<ReintentoMasivo> => (await apiClient.post<ReintentoMasivo>('/invoices/retry-batch',undefined,{timeout:120000})).data,
};
