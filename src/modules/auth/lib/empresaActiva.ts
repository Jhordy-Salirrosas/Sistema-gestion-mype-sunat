/**
 * Resolución de la EMPRESA ACTIVA de la sesión.
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 *
 * `POST /auth/login` devuelve `accessToken`, `refreshToken` y `user`, pero **NO
 * devuelve `companies`**. El front tenía el patrón
 *
 *     if (data.companies && data.companies.length > 0) setActiveCompany(...)
 *
 * repetido en cinco sitios, y como ese campo nunca llega, la condición nunca se
 * cumplía: `activeCompany` quedaba en `null` en TODAS las sesiones reales.
 *
 * El daño en cadena era visible y confuso: la barra superior decía "Sin empresa
 * seleccionada", la pantalla de Configuración no listaba el RUC ni las series
 * aunque existieran, y todo documento construido en el front (QR, visor XML)
 * salía con el emisor en blanco.
 *
 * `GET /auth/profile` sí trae la empresa con su RUC y su razón social, y el
 * `companyId` viaja dentro del JWT, así que la identidad fiscal siempre estuvo
 * disponible — solo que nadie la pedía.
 */
import { authApi } from '@/modules/auth/services/authApi';
import { useAuthStore, type ActiveCompany } from '@/stores/authStore';

/** Traduce la empresa que devuelve `/auth/profile` al modelo del store. */
const aEmpresaActiva = (perfil: {
  company?: {
    id: string;
    ruc: string;
    legalName: string;
    isActive?: boolean;
  } | null;
}): ActiveCompany | null => {
  const empresa = perfil.company;
  if (!empresa?.ruc) return null;

  return {
    tenantId: empresa.id,
    ruc: empresa.ruc,
    razonSocial: empresa.legalName,
  };
};

/**
 * Carga la empresa del usuario en sesión y la deja en el store.
 *
 * Devuelve la empresa aplicada, o `null` si no se pudo resolver. **No lanza**:
 * un fallo aquí no debe tumbar el login, que ya se completó con el token. Lo que
 * sí hace es dejar el store sin empresa, y eso se nota en pantalla —que es
 * preferible a inventar un RUC.
 *
 * Es idempotente: si ya hay una empresa activa no se vuelve a pedir, salvo que
 * se fuerce, para que recargar la página no dispare una petición de más.
 */
export const cargarEmpresaActiva = async (
  forzar = false,
): Promise<ActiveCompany | null> => {
  const yaTiene = useAuthStore.getState().activeCompany;
  if (yaTiene && !forzar) return yaTiene;

  try {
    const perfil = await authApi.getProfile();
    const empresa = aEmpresaActiva(perfil);
    if (empresa) {
      useAuthStore.getState().setActiveCompany(empresa);
      return empresa;
    }
    return null;
  } catch {
    return null;
  }
};
