/**
 * Identidad de la empresa emisora para las exportaciones del módulo M1.
 *
 * POR QUÉ NO SON CONSTANTES LITERALES
 *
 * Antes este archivo exportaba `RUC_EMISOR = '20601012341'` como texto fijo. Ese
 * literal acababa en la trama del QR, en el XML que arma el front y en el nombre
 * del archivo RVIE, mientras el backend firmaba y enviaba con el RUC real de la
 * empresa (20601234567). El resultado: la misma aplicación mostraba dos RUC para
 * el mismo emisor, y el comprobante impreso no coincidía con el que SUNAT
 * aceptó.
 *
 * El RUC efectivo se consulta en la configuración de M1. La empresa de la
 * sesión conserva su identidad compartida y sirve como respaldo si la API
 * no responde. Los formateadores puros reciben la identidad ya resuelta.
 */
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/axios';
import { useAuthStore, type ActiveCompany } from '@/stores/authStore';

/** RUC efectivo de M1, con respaldo de sesión cuando la configuración no responde. */
export const rucEmisorActual = async (): Promise<string> =>
  (await cargarIdentidadEmisora()).ruc;

/** Razón social del emisor de la sesión. */
export const razonSocialEmisoraActual = (): string =>
  (useAuthStore.getState().activeCompany?.razonSocial ?? '').trim();

/**
 * Identidad mínima del emisor para construir un documento.
 *
 * Se agrupan las tres en un solo objeto porque siempre viajan juntas: un XML con
 * RUC de una empresa y razón social de otra es un documento nulo. Si no hay RUC,
 * `hayEmisor` es false y quien consume puede avisar en lugar de generar.
 */
export interface IdentidadEmisora {
  ruc: string;
  razonSocial: string;
  hayEmisor: boolean;
}

export const identidadEmisora = (
  empresa?: ActiveCompany | null,
  rucConfigurado?: string,
): IdentidadEmisora => {
  const activa = empresa ?? useAuthStore.getState().activeCompany;
  const ruc = rucConfigurado && /^[0-9]{11}$/.test(rucConfigurado) ? rucConfigurado : (activa?.ruc ?? '').trim();
  const razonSocial = (activa?.razonSocial ?? '').trim();

  return { ruc, razonSocial, hayEmisor: ruc.length > 0 };
};

/** Misma configuración efectiva que consulta la pantalla del emisor; sin caché entre empresas. */
export async function cargarIdentidadEmisora(): Promise<IdentidadEmisora> {
  const { activeCompany, token } = useAuthStore.getState();
  if (!activeCompany) return identidadEmisora();
  let ruc: string | undefined;
  try {
    const { data } = await apiClient.get<{ ruc?: string }>('/invoices/config');
    ruc = data?.ruc;
  } catch { /* Configuración no disponible: respaldo de la sesión. */ }
  const actual = useAuthStore.getState();
  if (actual.activeCompany?.tenantId !== activeCompany.tenantId || actual.token !== token) {
    throw new Error('La sesión cambió durante la consulta del emisor.');
  }
  return identidadEmisora(activeCompany, ruc);
}

/** El QR espera la consulta para no mostrar temporalmente el RUC de otro origen. */
export function useIdentidadEmisora(): IdentidadEmisora | null {
  const empresa = useAuthStore(state => state.activeCompany);
  const token = useAuthStore(state => state.token);
  const key = JSON.stringify([empresa?.tenantId, empresa?.ruc, empresa?.razonSocial, token]);
  const [resultado, setResultado] = useState<{ key: string; identidad: IdentidadEmisora } | null>(null);
  useEffect(() => {
    let vigente = true;
    void cargarIdentidadEmisora().then(identidad => {
      if (vigente) setResultado({ key, identidad });
    }).catch(() => { /* La respuesta de una sesión anterior no se muestra. */ });
    return () => { vigente = false; };
  }, [key]);
  return resultado?.key === key ? resultado.identidad : null;
}
