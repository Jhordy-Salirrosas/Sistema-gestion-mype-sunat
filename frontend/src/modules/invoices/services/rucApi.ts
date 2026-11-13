import { apiClient } from '@/lib/axios';

export interface DatosRuc {
  ruc: string;
  razonSocial: string;
  direccionFiscal: string | null;
  ubigeo: string | null;
  estadoContribuyente: string;
  condicionDomicilio: string;
}

export async function consultarRuc(ruc: string): Promise<DatosRuc> {
  const { data } = await apiClient.get<DatosRuc>(`/sunat/ruc/${ruc}`);
  if (data.ruc !== ruc || !data.razonSocial?.trim()) throw new Error('Respuesta RUC inválida');
  return data;
}
