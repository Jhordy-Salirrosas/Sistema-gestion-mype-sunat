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
 * Un RUC es un dato fiscal del inquilino, no una propiedad del código. Ahora se
 * lee de la empresa activa de la sesión y, si no hay sesión, se deja vacío: es
 * preferible un documento que diga que no hay emisor a uno que invente uno.
 */
import { useAuthStore, type ActiveCompany } from '@/stores/authStore';

/** RUC del emisor de la sesión, o cadena vacía si no hay empresa activa. */
export const rucEmisorActual = (): string =>
  (useAuthStore.getState().activeCompany?.ruc ?? '').trim();

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
): IdentidadEmisora => {
  const activa = empresa ?? useAuthStore.getState().activeCompany;
  const ruc = (activa?.ruc ?? '').trim();
  const razonSocial = (activa?.razonSocial ?? '').trim();

  return { ruc, razonSocial, hayEmisor: ruc.length > 0 };
};
