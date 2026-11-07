/**
 * Sesión de demostración para revisar la interfaz sin backend levantado.
 *
 * El `authStore` persiste la sesión en `localStorage` bajo `sync-sunat-auth`.
 * Este módulo instala una sesión sintética (rol ADMIN y empresa demo) para que
 * las rutas protegidas se muestren sin la API.
 *
 * Se ejecuta de forma SÍNCRONA al importar el módulo de rutas: la hidratación
 * de Zustand ocurre en el primer render, y cualquier intento posterior llega
 * demasiado tarde (ProtectedRoute ya habría redirigido a /login).
 *
 * Solo se activa en desarrollo; en producción el login exige el backend real.
 */
import type { ActiveCompany, UserSession } from '@/stores/authStore';
const RUC_EMISOR = '20601234567';

/** Clave de persistencia definida en `stores/authStore.ts`. */
export const AUTH_STORAGE_KEY = 'sync-sunat-auth';

/** Empresa demo alineada con los comprobantes de ejemplo del módulo M1. */
export const EMPRESA_DEMO: ActiveCompany = {
  tenantId: 'demo-tenant',
  ruc: RUC_EMISOR,
  razonSocial: 'MYPE CONFECCIONES INDUSTRIALES S.A.C.',
  regimen: 'MYPE_TRIBUTARIO',
};

/** Usuario demo con permisos plenos de facturación. */
export const USUARIO_DEMO: UserSession = {
  id: 'demo-user',
  email: 'admin@mype.pe',
  name: 'Admin Demo',
  fullName: 'Admin Demo',
  role: 'ADMIN',
};

/** Indica si el modo demostración está habilitado (solo en desarrollo). */
export const usuarioDemoDisponible = (): boolean =>
  import.meta.env.DEV === true;

/** Estructura que espera `persist` de Zustand en el almacenamiento. */
interface SesionPersistida {
  state: {
    token: string;
    user: UserSession;
    activeCompany: ActiveCompany;
    isAuthenticated: boolean;
  };
  version: number;
}

/** Construye el JSON de sesión que consume el `authStore`. */
export const construirSesionDemo = (): string => {
  const sesion: SesionPersistida = {
    state: {
      token: 'demo-token',
      user: USUARIO_DEMO,
      activeCompany: EMPRESA_DEMO,
      isAuthenticated: true,
    },
    version: 0,
  };

  return JSON.stringify(sesion);
};

/**
 * Instala la sesión demo si no hay una activa.
 *
 * Debe invocarse ANTES de que React monte el árbol. Devuelve `true` cuando la
 * sesión quedó disponible en el almacenamiento.
 */
export const instalarSesionDemo = (
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): boolean => {
  const existente = storage.getItem(AUTH_STORAGE_KEY);

  if (existente) {
    try {
      const parsed = JSON.parse(existente) as SesionPersistida;
      if (parsed.state?.isAuthenticated && parsed.state.token) return true;
    } catch {
      // Sesión corrupta: se sobrescribe con la demo.
    }
  }

  storage.setItem(AUTH_STORAGE_KEY, construirSesionDemo());
  return true;
};
