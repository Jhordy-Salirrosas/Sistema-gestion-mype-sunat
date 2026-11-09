import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import type { SerieFe } from '../lib/invoiceSettings';

/** Respuesta cruda de `GET /invoices/config`. */
export type EntornoFiscal = 'MOCK' | 'BETA' | 'PRODUCCION';
export type PerfilComercial = 'MAYORISTA' | 'MINORISTA';

/** Determina el comprobante por defecto según el perfil comercial de la empresa. */
export const tipoComprobantePorPerfil = (
  perfil: PerfilComercial | null | undefined,
): '01' | '03' | null => {
  if (perfil === 'MAYORISTA') return '01';
  if (perfil === 'MINORISTA') return '03';
  return null;
};

export interface ConfiguracionInput {
  local_anexo?: string | null;
  domicilio_fiscal?: string | null;
  ubigeo_fiscal?: string | null;
  departamento_fiscal?: string | null;
  provincia_fiscal?: string | null;
  distrito_fiscal?: string | null;

  entorno?: EntornoFiscal;
  perfil_comercial?: PerfilComercial | null;
  sol_user?: string;
  sol_password?: string;
  cert_base64?: string;
  cert_password?: string;
}
export interface EstadoCertificadoBackend {
  archivo: string | null;
  causa?: string | null;
  detalle?: string | null;
  configurado: boolean;
  estado: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'AUN_NO_VIGENTE' | 'INVALIDO' | 'NO_CONFIGURADO';
  vence_el: string | null;
  dias_restantes: number | null;
  origen: 'company' | 'deployment';
}

export interface ConfiguracionBackend {
  ruc?: string;
  local_anexo?: string | null;
  domicilio_fiscal?: string | null;
  ubigeo_fiscal?: string | null;
  departamento_fiscal?: string | null;
  provincia_fiscal?: string | null;
  distrito_fiscal?: string | null;

  certificado?: EstadoCertificadoBackend;
  perfil_comercial?: PerfilComercial | null;
  origen_efectivo?: 'company' | 'deployment';
  origen_sol?: 'company' | 'deployment';
  origen_certificado?: 'company' | 'deployment';
  sol_password_configurada?: boolean;
  cert_password_configurada?: boolean;
  entorno?: string | null;
  endpoint_bill_service?: string;
  endpoint_consult_service?: string;
  listo_para_emitir?: boolean;
  checklist?: Array<{
    clave: string;
    descripcion: string;
    configurado: boolean;
    obligatorio: boolean;
    detalle?: string;
  }>;
  series?: Array<{
    document_type: string;
    series: string;
    current_correlative: number;
    is_active: boolean;
  }>;
}

/** Lo que consume la pantalla, ya normalizado. */
export interface ConfiguracionFeVista extends Omit<ConfiguracionBackend, 'series'> {
  perfil_comercial?: PerfilComercial | null;
  entorno: string | null;
  endpoint_bill_service: string;
  endpoint_consult_service: string;
  listo_para_emitir: boolean;
  checklist: NonNullable<ConfiguracionBackend['checklist']>;
  /** Series ya convertidas al tipo de la pantalla. */
  series: SerieFe[];
}

/**
 * Convierte las series del backend al tipo de la pantalla.
 *
 * El backend llama `current_correlative` al ÚLTIMO número usado, no al próximo:
 * por eso aquí se suma 1. Mostrar el último usado como "próximo a emitir" haría
 * que el usuario creyera que va a repetir un número ya emitido, que es el
 * defecto exacto que TA-60 corrigió en el servidor.
 */
export const aSerieFe = (fila: {
  document_type: string;
  series: string;
  current_correlative: number;
  is_active: boolean;
}): SerieFe => ({
  serie: fila.series,
  tipoComprobante: fila.document_type,
  siguienteCorrelativo: fila.current_correlative + 1,
  activa: fila.is_active,
});

export const useInvoiceConfig = (ruc: string) => {
  const consulta = useQuery({
    queryKey: ['invoices', 'config', ruc],
    queryFn: async (): Promise<ConfiguracionFeVista> => {
      const { data } = await apiClient.get<ConfiguracionBackend>(
        '/invoices/config',
      );

      const series =
        data.series && data.series.length > 0
          ? data.series
          : await apiClient
              .get<ConfiguracionBackend['series']>('/invoices/series')
              .then((respuesta) => respuesta.data ?? [])
              .catch(() => []);

      return {
        ...data,
        perfil_comercial:
          data.perfil_comercial === 'MAYORISTA' || data.perfil_comercial === 'MINORISTA'
            ? data.perfil_comercial
            : null,
        entorno: data.entorno ?? null,
        endpoint_bill_service: data.endpoint_bill_service ?? '',
        endpoint_consult_service: data.endpoint_consult_service ?? '',
        listo_para_emitir: data.listo_para_emitir ?? false,
        checklist: data.checklist ?? [],
        series: (series ?? []).map(aSerieFe),
      };
    },
    staleTime: 1000 * 60 * 5,
    enabled: ruc !== '',
    retry: 1,
  });

  return {
    data: consulta.data,
    error: consulta.error,
    cargando: consulta.isLoading,
    recargar: consulta.refetch,
    guardar: async (input: ConfiguracionInput) => {
      await apiClient.put('/invoices/config', input);
      await consulta.refetch();
    },
  };
};
